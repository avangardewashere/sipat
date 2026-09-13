"use client";

import { useId } from "react";
import { formatSession, type FocusSession } from "@/lib/sessions/session";

/** Long logs only show the most recent entries. */
export const SESSION_LOG_LIMIT = 20;

type Props = {
  sessions: FocusSession[];
  loaded: boolean;
  /** Shown when saving failed. */
  notice: string | null;
  /** Only passed by tests, to make date formatting predictable. */
  locale?: string;
};

export function SessionLog({ sessions, loaded, notice, locale }: Props) {
  const headingId = useId();
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.durationMs, 0) / 60_000);
  const newestFirst = [...sessions].reverse().slice(0, SESSION_LOG_LIMIT);

  return (
    <section aria-labelledby={headingId} className="flex w-full max-w-sm flex-col gap-3 text-left">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="text-sm font-medium">
          Session log
        </h2>
        {loaded && sessions.length > 0 && (
          <p className="text-xs text-foreground/60">
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"} · {totalMinutes} min
          </p>
        )}
      </div>

      {notice && (
        <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">
          {notice}
        </p>
      )}

      {!loaded ? (
        <p className="text-sm text-foreground/60">Loading your sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-foreground/60">No focus sessions yet. Finish one and it&apos;ll show up here.</p>
      ) : (
        <>
          <ol className="flex flex-col divide-y divide-foreground/10 rounded-2xl border border-foreground/10">
            {newestFirst.map((session) => {
              const { date, timeRange, minutes } = formatSession(session, locale);
              return (
                <li key={session.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span>
                    <span className="text-foreground/60">{date} · </span>
                    <span className="tabular-nums">{timeRange}</span>
                  </span>
                  <span className="font-medium tabular-nums">{minutes}</span>
                </li>
              );
            })}
          </ol>
          {sessions.length > SESSION_LOG_LIMIT && (
            <p className="text-xs text-foreground/60">Showing the latest {SESSION_LOG_LIMIT}.</p>
          )}
        </>
      )}
    </section>
  );
}
