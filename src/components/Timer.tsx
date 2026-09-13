"use client";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTimer } from "@/hooks/useTimer";
import { formatRemaining } from "@/lib/timer/format";
import type { TimerStatus } from "@/lib/timer/timer";

const APP_NAME = "Sipat";

const STATUS_LABEL: Record<TimerStatus, string> = {
  idle: "Ready",
  running: "Focusing",
  paused: "Paused",
  finished: "Time's up",
};

export function tabTitle(status: TimerStatus, display: string): string {
  switch (status) {
    case "idle":
      return APP_NAME;
    case "running":
      return `${display} · ${APP_NAME}`;
    case "paused":
      return `Paused ${display} · ${APP_NAME}`;
    case "finished":
      return `Time's up · ${APP_NAME}`;
  }
}

const buttonBase =
  "h-12 min-w-28 rounded-full px-6 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40";
const primaryButton = `${buttonBase} bg-foreground text-background hover:opacity-90`;
const secondaryButton = `${buttonBase} border border-foreground/20 hover:bg-foreground/5 disabled:hover:bg-transparent`;

export function Timer({ durationMs }: { durationMs: number }) {
  const { status, remainingMs, start, pause, reset } = useTimer(durationMs);
  const display = formatRemaining(remainingMs);

  useDocumentTitle(tabTitle(status, display));

  return (
    <section aria-label="Focus timer" className="flex flex-col items-center gap-8">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-foreground/60">{STATUS_LABEL[status]}</p>

      {/* role="timer" tells assistive tech this is a clock. It doesn't announce every
          second, which would be unbearable for screen-reader users. */}
      <p role="timer" className="font-mono text-7xl font-semibold tabular-nums tracking-tight sm:text-9xl">
        {display}
      </p>

      <div className="flex gap-3">
        {status === "running" ? (
          <button type="button" className={primaryButton} onClick={pause}>
            Pause
          </button>
        ) : (
          <button type="button" className={primaryButton} onClick={start} disabled={status === "finished"}>
            {status === "paused" ? "Resume" : "Start"}
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={reset} disabled={status === "idle"}>
          Reset
        </button>
      </div>
    </section>
  );
}
