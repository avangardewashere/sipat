/**
 * Weekly stats: pure date math over saved sessions.
 *
 * Rules that apply everywhere in this file:
 * - Days and weeks are LOCAL to the viewer. Days are built from local calendar parts with
 *   `new Date(year, month, day)`, never by adding 24 hours, because a day isn't always 24 hours
 *   (daylight saving makes 23- and 25-hour days). Never `toISOString()` either: it's UTC, so at
 *   UTC+8 anything before 08:00 lands on the previous day. (The same rule as Habibit.)
 * - Weeks start on Monday.
 * - A session's focus minutes are shared across the days its time span covers, so a session from
 *   23:50 to 00:15 gives 10 minutes to one day and 15 to the next.
 * - A session *counts* as one session on the day it ended.
 */

import type { FocusSession } from "@/lib/sessions/session";

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** The start of the local day `n` days after the day containing `ms`. */
export function addLocalDays(ms: number, n: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

/** Monday 00:00 (local) of the week containing `ms`. */
export function startOfLocalWeek(ms: number): number {
  const daysSinceMonday = (new Date(ms).getDay() + 6) % 7; // getDay(): Sunday = 0
  return addLocalDays(ms, -daysSinceMonday);
}

/** "2026-09-14" from local calendar parts. */
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DayStat = {
  key: string;
  /** Local midnight at the start of the day. */
  start: number;
  /** Local midnight at the start of the next day (not always start + 24 h). */
  end: number;
  focusMs: number;
  sessionCount: number;
};

export type WeekStats = {
  start: number;
  end: number;
  days: DayStat[];
  totalMs: number;
  sessionCount: number;
  /** The day with the most focus; the earliest wins a tie. Null for an empty week. */
  bestDay: DayStat | null;
};

export function weekStats(sessions: FocusSession[], weekStart: number): WeekStats {
  const days: DayStat[] = Array.from({ length: 7 }, (_, i) => {
    const start = addLocalDays(weekStart, i);
    return { key: localDayKey(start), start, end: addLocalDays(weekStart, i + 1), focusMs: 0, sessionCount: 0 };
  });
  const weekEnd = days[6].end;

  for (const session of sessions) {
    const { startedAt, endedAt, durationMs } = session;
    const span = endedAt - startedAt;
    // Time spans are half-open, [start, end): a session ending exactly at midnight belongs to the
    // day before, so for counting, look at the last millisecond it actually covered.
    const countAt = span > 0 ? endedAt - 1 : endedAt;
    if (countAt < weekStart || startedAt >= weekEnd) continue;

    for (const day of days) {
      if (span > 0) {
        const overlap = Math.min(endedAt, day.end) - Math.max(startedAt, day.start);
        // Pauses aren't recorded, so focus is spread evenly across the span: an honest estimate.
        if (overlap > 0) day.focusMs += (durationMs * overlap) / span;
      } else if (endedAt >= day.start && endedAt < day.end) {
        day.focusMs += durationMs;
      }
      if (countAt >= day.start && countAt < day.end) day.sessionCount += 1;
    }
  }

  const totalMs = days.reduce((sum, d) => sum + d.focusMs, 0);
  const bestDay = days.reduce<DayStat | null>((best, d) => (d.focusMs > (best?.focusMs ?? 0) ? d : best), null);

  return {
    start: weekStart,
    end: weekEnd,
    days,
    totalMs,
    sessionCount: days.reduce((sum, d) => sum + d.sessionCount, 0),
    bestDay,
  };
}

/** "25 min", "1 h", "2 h 5 min". Rounded to whole minutes. */
export function formatFocus(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * A y-axis with clean tick values (in minutes): 0, 15, 30, 45, 60, never 0, 13.7, 27.4…
 * Picks the smallest friendly step that fits the tallest day in at most 4 steps.
 */
export function niceAxis(maxMs: number): { maxMinutes: number; ticks: number[] } {
  const maxMinutes = Math.max(0, maxMs / 60_000);
  if (maxMinutes === 0) return { maxMinutes: 60, ticks: [0, 30, 60] };

  const steps = [5, 10, 15, 30, 60, 120, 180, 240];
  let step = steps.find((s) => Math.ceil(maxMinutes / s) <= 4);
  if (step === undefined) {
    step = 240;
    while (Math.ceil(maxMinutes / step) > 4) step *= 2;
  }
  const top = Math.ceil(maxMinutes / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  return { maxMinutes: top, ticks };
}
