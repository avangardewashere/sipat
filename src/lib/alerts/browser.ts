/**
 * The "time's up" side effects: a chime, a vibration, and a system notification.
 *
 * Everything touching browser APIs lives here, behind one small `Alerts` interface. Components
 * receive an `Alerts` object instead of calling these APIs directly, so tests can pass in fakes,
 * and a future version (e.g. service-worker notifications) can be swapped in without touching the UI.
 *
 * Every function fails quietly: a browser without audio, vibration or notifications still gets a
 * working timer.
 */

export type PermissionResult = NotificationPermission | "unsupported";

export type Alerts = {
  /** Call from a click handler. Browsers only allow sound after the user has interacted with the page. */
  unlockSound(): void;
  chime(): void;
  vibrate(): void;
  /** Returns false if the notification couldn't be shown. */
  notify(title: string, body: string): boolean;
  requestNotificationPermission(): Promise<PermissionResult>;
};

type AudioContextConstructor = typeof AudioContext;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  const Ctor: AudioContextConstructor | undefined =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioContext = new Ctor();
  } catch {
    return null;
  }
  return audioContext;
}

export function unlockSound(): void {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
}

/** A soft three-note chime, generated on the fly, so there's no audio file to download. */
export function chime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  const start = ctx.currentTime + 0.05;
  [880, 660, 990].forEach((frequency, i) => {
    const t = start + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    // Quick fade in and out, so the notes don't click.
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

export function vibrate(): void {
  // Supported by Android Chrome. Desktop and iOS browsers just don't have it.
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate([200, 100, 200]);
  }
}

export function notify(title: string, body: string): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    // `tag` makes a new notification replace an old unread one instead of stacking up.
    new Notification(title, { body, tag: "sipat-phase" });
    return true;
  } catch {
    // Android Chrome has the Notification API but throws here: it only allows notifications
    // shown from a service worker (an installed-app feature we don't have yet).
    return false;
  }
}

export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}

export const browserAlerts: Alerts = { unlockSound, chime, vibrate, notify, requestNotificationPermission };
