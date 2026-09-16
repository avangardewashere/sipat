"use client";

import { useState } from "react";
import { SessionLog } from "@/components/SessionLog";
import { SettingsPanel } from "@/components/SettingsPanel";
import { WeeklyStats } from "@/components/WeeklyStats";
import { useCompletionEffect } from "@/hooks/useCompletionEffect";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useStoredData } from "@/hooks/useStoredData";
import { browserAlerts, type Alerts, type PermissionResult } from "@/lib/alerts/browser";
import { completionMessage, filledDots, sessionNumber } from "@/lib/pomodoro/pomodoro";
import type { Preferences } from "@/lib/pomodoro/preferences";
import { DEFAULT_SETTINGS, PHASE_LABEL, type Phase, type PomodoroSettings } from "@/lib/pomodoro/settings";
import { mergeSessions, sessionFromCompletion, type FocusSession } from "@/lib/sessions/session";
import { browserRepository, type SipatRepository } from "@/lib/storage/repository";
import { formatRemaining } from "@/lib/timer/format";
import type { TimerStatus } from "@/lib/timer/timer";

const APP_NAME = "Sipat";

export function tabTitle(phase: Phase, status: TimerStatus, display: string): string {
  const label = PHASE_LABEL[phase];
  switch (status) {
    case "running":
      return `${display} · ${label} · ${APP_NAME}`;
    case "paused":
      return `Paused ${display} · ${label} · ${APP_NAME}`;
    case "idle":
    case "finished":
      return `${label} · ${APP_NAME}`;
  }
}

const STATUS_LABEL: Record<TimerStatus, string> = {
  idle: "Ready",
  running: "Running",
  paused: "Paused",
  finished: "Done",
};

const PERMISSION_NOTICE: Record<Exclude<PermissionResult, "granted">, string> = {
  denied: "Notifications are blocked for this site. You can allow them in your browser's site settings.",
  default: "Notification permission wasn't granted.",
  unsupported: "This browser doesn't support notifications. You'll still get sound and vibration.",
};

const NOTIFY_FAILED_NOTICE =
  "This browser only shows notifications for installed apps, so you'll get sound and vibration instead.";

const STORAGE_FAILED_NOTICE =
  "Couldn't save to this browser's storage (it may be full or blocked). New sessions and settings will be lost when you close this tab.";

const buttonBase =
  "h-12 min-w-24 rounded-full px-6 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40";
const primaryButton = `${buttonBase} bg-foreground text-background hover:opacity-90`;
const secondaryButton = `${buttonBase} border border-foreground/20 hover:bg-foreground/5 disabled:hover:bg-transparent`;

type Props = {
  /** Used until saved settings load, and whenever nothing has been saved yet. */
  initialSettings?: PomodoroSettings;
  /** The time's-up side effects. Tests pass fakes; the app uses the real browser APIs. */
  alerts?: Alerts;
  /** Where sessions and preferences are saved. Tests pass in-memory storage; the app uses localStorage. */
  repository?: SipatRepository;
  /** Only passed by tests, to make dates in the session log predictable. */
  locale?: string;
};

export function Pomodoro({
  initialSettings = DEFAULT_SETTINGS,
  alerts = browserAlerts,
  repository = browserRepository,
  locale,
}: Props) {
  const { state, remainingMs, start, pause, reset, skip, updateSettings } = usePomodoro(initialSettings);
  const { phase, timer, settings } = state;
  const status = timer.status;
  const display = formatRemaining(remainingMs);
  const isBreak = phase !== "focus";

  const [soundOn, setSoundOn] = useState(true);
  const [notifyOn, setNotifyOn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  useDocumentTitle(tabTitle(phase, status, display));

  useStoredData(repository, ({ preferences, sessions: saved }) => {
    if (preferences) {
      updateSettings(preferences.settings);
      setSoundOn(preferences.soundOn);
    }
    // Merge rather than replace, in case a session finished while loading.
    setSessions((current) => mergeSessions(saved, current));
    setLoaded(true);
  });

  function persistPreferences(preferences: Preferences) {
    repository.savePreferences(preferences).catch(() => setStorageNotice(STORAGE_FAILED_NOTICE));
  }

  useCompletionEffect(state.lastCompletion, (completion) => {
    if (soundOn) {
      alerts.chime();
      alerts.vibrate();
    }
    if (notifyOn) {
      // By now `phase` is already the *next* phase, which is exactly what the message announces.
      const { title, body } = completionMessage(completion.phase, phase, settings);
      if (!alerts.notify(title, body)) setNotice(NOTIFY_FAILED_NOTICE);
    }

    const session = sessionFromCompletion(completion);
    if (session) {
      // Show it straight away ("optimistic"), then replace the list with what storage actually
      // holds, which may include sessions saved by another tab. If saving fails, the session
      // stays visible for this visit and a notice explains.
      setSessions((current) => mergeSessions(current, [session]));
      repository.addSession(session).then(
        (stored) => setSessions((current) => mergeSessions(stored, current)),
        () => setStorageNotice(STORAGE_FAILED_NOTICE),
      );
    }
  });

  function handleStart() {
    // A click is the moment browsers allow audio to be switched on for later.
    alerts.unlockSound();
    start();
  }

  async function handleNotifyChange(on: boolean) {
    setNotice(null);
    if (!on) {
      setNotifyOn(false);
      return;
    }
    const permission = await alerts.requestNotificationPermission();
    if (permission === "granted") {
      setNotifyOn(true);
    } else {
      setNotifyOn(false);
      setNotice(PERMISSION_NOTICE[permission]);
    }
  }

  const dots = filledDots(state);

  return (
    <div className="flex w-full flex-col items-center gap-10">
      <section aria-label="Pomodoro timer" className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <h2 className={`text-xl font-semibold ${isBreak ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
            {PHASE_LABEL[phase]}
          </h2>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-foreground/60">{STATUS_LABEL[status]}</p>
        </div>

        {/* role="timer" tells assistive tech this is a clock, without announcing every second. */}
        <p role="timer" className="font-mono text-7xl font-semibold tabular-nums tracking-tight sm:text-9xl">
          {display}
        </p>

        <div className="flex flex-col items-center gap-2">
          <ol aria-hidden="true" className="flex gap-2">
            {Array.from({ length: settings.longBreakEvery }, (_, i) => (
              <li
                key={i}
                className={`size-2.5 rounded-full ${i < dots ? "bg-foreground" : "border border-foreground/30"}`}
              />
            ))}
          </ol>
          <p className="text-sm text-foreground/60">
            {phase === "focus"
              ? `Session ${sessionNumber(state)} of ${settings.longBreakEvery}`
              : `${dots} of ${settings.longBreakEvery} sessions done`}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {status === "running" ? (
            <button type="button" className={primaryButton} onClick={pause}>
              Pause
            </button>
          ) : (
            <button type="button" className={primaryButton} onClick={handleStart}>
              {status === "paused" ? "Resume" : "Start"}
            </button>
          )}
          <button type="button" className={secondaryButton} onClick={reset} disabled={status === "idle"}>
            Reset
          </button>
          <button type="button" className={secondaryButton} onClick={skip}>
            {isBreak ? "Skip break" : "Skip focus"}
          </button>
        </div>
      </section>

      {/* Rendered once saved sessions have loaded, so it's never computed from an empty list
          or from the server's pre-render time. */}
      {loaded && <WeeklyStats sessions={sessions} locale={locale} />}

      <SessionLog sessions={sessions} loaded={loaded} notice={storageNotice} locale={locale} />

      <SettingsPanel
        // The form copies `settings` into its draft once, when it mounts. Changing the key after
        // saved settings load gives it a fresh mount, so the fields show the saved values.
        key={loaded ? "loaded" : "defaults"}
        settings={settings}
        onSave={(next) => {
          updateSettings(next);
          persistPreferences({ settings: next, soundOn });
        }}
        phaseInProgress={status !== "idle"}
        soundOn={soundOn}
        onSoundChange={(on) => {
          setSoundOn(on);
          persistPreferences({ settings, soundOn: on });
        }}
        notifyOn={notifyOn}
        onNotifyChange={handleNotifyChange}
        notice={notice}
      />
    </div>
  );
}
