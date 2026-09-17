"use client";

import { useState } from "react";
import { SessionLog } from "@/components/SessionLog";
import { SettingsPanel } from "@/components/SettingsPanel";
import { WeeklyStats } from "@/components/WeeklyStats";
import { useCompletionEffect } from "@/hooks/useCompletionEffect";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useSaveCycle } from "@/hooks/useSaveCycle";
import { useStoredData } from "@/hooks/useStoredData";
import { browserAlerts, type Alerts, type PermissionResult } from "@/lib/alerts/browser";
import { completionMessage, filledDots, sessionNumber, type PhaseCompletion } from "@/lib/pomodoro/pomodoro";
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

/** "Your focus session finished at 10:25 while Sipat was closed…" */
export function awayMessage(completion: PhaseCompletion, locale?: string): string {
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    completion.finishedAt,
  );
  return completion.phase === "focus"
    ? `Your focus session finished at ${time} while Sipat was closed. It's in your log.`
    : `Your ${PHASE_LABEL[completion.phase].toLowerCase()} ended at ${time} while Sipat was closed.`;
}

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
  const { state, remainingMs, start, pause, reset, skip, updateSettings, restore } = usePomodoro(initialSettings);
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
  const [awayNotice, setAwayNotice] = useState<string | null>(null);

  useDocumentTitle(tabTitle(phase, status, display));

  useStoredData(repository, ({ preferences, sessions: saved, cycle }) => {
    if (preferences) {
      updateSettings(preferences.settings);
      setSoundOn(preferences.soundOn);
    }
    // Order with the settings above doesn't matter: an idle phase always takes its length from the
    // current settings, and a running or paused one keeps the length it started with.
    if (cycle) restore(cycle);
    // Merge rather than replace, in case a session finished while loading.
    setSessions((current) => mergeSessions(saved, current));
    setLoaded(true);
  });

  // Only once loading is done; saving earlier would overwrite the timer that's about to be restored.
  useSaveCycle(state, loaded, (cycle) => {
    repository.saveCycle(cycle).catch(() => setStorageNotice(STORAGE_FAILED_NOTICE));
  });

  function persistPreferences(preferences: Preferences) {
    repository.savePreferences(preferences).catch(() => setStorageNotice(STORAGE_FAILED_NOTICE));
  }

  useCompletionEffect(state.lastCompletion, (completion) => {
    if (completion.whileAway) {
      // It ended while the page was closed: a chime now would be late and confusing. Say so instead.
      setAwayNotice(awayMessage(completion, locale));
    } else if (soundOn) {
      alerts.chime();
      alerts.vibrate();
    }
    if (notifyOn && !completion.whileAway) {
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
    // A click (or key press) is the moment browsers allow audio to be switched on for later.
    alerts.unlockSound();
    setAwayNotice(null);
    start();
  }

  useKeyboardShortcuts((action) => {
    if (action === "toggle") {
      if (status === "running") pause();
      else handleStart();
    } else if (action === "reset") {
      reset();
    } else {
      skip();
    }
  });

  const [lastDeleted, setLastDeleted] = useState<FocusSession | null>(null);

  function handleDelete(id: string) {
    setLastDeleted(sessions.find((s) => s.id === id) ?? null);
    setSessions((current) => current.filter((s) => s.id !== id));
    repository.deleteSession(id).then(
      // Storage may hold sessions from another tab; keep those, but not the deleted one.
      (stored) => setSessions((current) => mergeSessions(stored, current.filter((s) => s.id !== id))),
      () => setStorageNotice(STORAGE_FAILED_NOTICE),
    );
  }

  function handleUndoDelete() {
    if (!lastDeleted) return;
    const restored = lastDeleted;
    setLastDeleted(null);
    setSessions((current) => mergeSessions(current, [restored]));
    // Same id as before, so this puts back exactly the session that was removed.
    repository.addSession(restored).then(
      (stored) => setSessions((current) => mergeSessions(stored, current)),
      () => setStorageNotice(STORAGE_FAILED_NOTICE),
    );
  }

  function handleClearAll() {
    setLastDeleted(null);
    setSessions([]);
    repository.clearSessions().catch(() => setStorageNotice(STORAGE_FAILED_NOTICE));
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
            <button type="button" className={primaryButton} onClick={pause} aria-keyshortcuts="Space">
              Pause
            </button>
          ) : (
            <button type="button" className={primaryButton} onClick={handleStart} aria-keyshortcuts="Space">
              {status === "paused" ? "Resume" : "Start"}
            </button>
          )}
          <button
            type="button"
            className={secondaryButton}
            onClick={reset}
            disabled={status === "idle"}
            aria-keyshortcuts="R"
          >
            Reset
          </button>
          <button type="button" className={secondaryButton} onClick={skip} aria-keyshortcuts="S">
            {isBreak ? "Skip break" : "Skip focus"}
          </button>
        </div>

        {awayNotice && (
          <div
            role="status"
            className="flex max-w-sm items-start gap-3 rounded-xl bg-foreground/5 px-4 py-3 text-left text-sm"
          >
            <p className="flex-1">{awayNotice}</p>
            <button
              type="button"
              onClick={() => setAwayNotice(null)}
              className="-my-2.5 h-11 shrink-0 rounded-full px-3 font-medium hover:bg-foreground/10"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Only shown where a mouse or trackpad suggests a keyboard is likely at hand. */}
        <p className="hidden text-xs text-foreground/50 [@media(pointer:fine)]:block">
          Shortcuts: <kbd className="font-sans font-medium">Space</kbd> start/pause ·{" "}
          <kbd className="font-sans font-medium">R</kbd> reset · <kbd className="font-sans font-medium">S</kbd> skip
        </p>
      </section>

      {/* Rendered once saved sessions have loaded, so it's never computed from an empty list
          or from the server's pre-render time. */}
      {loaded && <WeeklyStats sessions={sessions} locale={locale} />}

      <SessionLog
        sessions={sessions}
        loaded={loaded}
        notice={storageNotice}
        lastDeleted={lastDeleted}
        onDelete={handleDelete}
        onUndoDelete={handleUndoDelete}
        onClearAll={handleClearAll}
        locale={locale}
      />

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
