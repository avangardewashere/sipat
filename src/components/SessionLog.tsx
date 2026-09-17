"use client";

import { useId, useState } from "react";
import { formatSession, type FocusSession } from "@/lib/sessions/session";

/** Long logs only show the most recent entries. */
export const SESSION_LOG_LIMIT = 20;

type Props = {
  sessions: FocusSession[];
  loaded: boolean;
  /** Shown when saving failed. */
  notice: string | null;
  /** The session just deleted, while it can still be undone. */
  lastDeleted: FocusSession | null;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
  onClearAll: () => void;
  /** Only passed by tests, to make date formatting predictable. */
  locale?: string;
};

export function SessionLog({
  sessions,
  loaded,
  notice,
  lastDeleted,
  onDelete,
  onUndoDelete,
  onClearAll,
  locale,
}: Props) {
  const headingId = useId();
  // Clearing everything can't be undone, so it takes two clicks: ask, then confirm.
  const [confirmingClear, setConfirmingClear] = useState(false);
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

      {/* Deleting one session is quick to do by accident, so it's undoable instead of asking first. */}
      {lastDeleted && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl bg-foreground/5 px-4 py-2 text-sm"
        >
          <span>Session deleted.</span>
          <button
            type="button"
            onClick={onUndoDelete}
            className="h-9 rounded-full px-3 font-medium underline-offset-4 hover:underline"
          >
            Undo
          </button>
        </div>
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
                <li key={session.id} className="flex items-center justify-between gap-2 py-1 pl-4 pr-1 text-sm">
                  <span>
                    <span className="text-foreground/60">{date} · </span>
                    <span className="tabular-nums">{timeRange}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium tabular-nums">{minutes}</span>
                    <button
                      type="button"
                      aria-label={`Delete session ${date}, ${timeRange}`}
                      onClick={() => onDelete(session.id)}
                      className="size-11 rounded-full text-lg text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
          {sessions.length > SESSION_LOG_LIMIT && (
            <p className="text-xs text-foreground/60">Showing the latest {SESSION_LOG_LIMIT}.</p>
          )}

          {confirmingClear ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm">
              <span>
                Delete all {sessions.length} {sessions.length === 1 ? "session" : "sessions"}? This can&apos;t be undone.
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="h-9 rounded-full px-3 font-medium hover:bg-foreground/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingClear(false);
                    onClearAll();
                  }}
                  className="h-9 rounded-full bg-red-600 px-3 font-medium text-white hover:bg-red-700"
                >
                  Delete all
                </button>
              </span>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="h-9 rounded-full px-3 text-xs font-medium text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
              >
                Clear history
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
