"use client";

import { useId, useState } from "react";
import type { FocusSession } from "@/lib/sessions/session";
import {
  addLocalDays,
  formatFocus,
  localDayKey,
  niceAxis,
  startOfLocalWeek,
  weekStats,
  type DayStat,
} from "@/lib/stats/week";

type Props = {
  /** Oldest first, as the repository returns them. */
  sessions: FocusSession[];
  /** Where "now" comes from. Tests pass a fixed clock. */
  clock?: () => number;
  /** Only passed by tests, to make date formatting predictable. */
  locale?: string;
};

const PLOT_HEIGHT_PX = 144;

export function WeeklyStats({ sessions, clock = Date.now, locale }: Props) {
  const headingId = useId();
  const [mountedAt] = useState(clock);
  // 0 = this week, -1 = last week, …
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [activeDay, setActiveDay] = useState<number | null>(null);

  // "Today" is when this appeared, or the end of the newest session if that's later. So a session
  // finished after midnight moves "today" forward without anything re-reading the clock.
  const now = Math.max(mountedAt, sessions.at(-1)?.endedAt ?? 0);
  const todayKey = localDayKey(now);
  const weekStart = addLocalDays(startOfLocalWeek(now), 7 * weekOffset);
  const stats = weekStats(sessions, weekStart);
  const axis = niceAxis(Math.max(...stats.days.map((d) => d.focusMs)));

  const dayName = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" });

  const rangeLabel = `${shortDate.format(stats.start)} – ${shortDate.format(stats.days[6].start)}`;
  const heading = weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : `Week of ${shortDate.format(stats.start)}`;
  const isFuture = (day: DayStat) => weekOffset === 0 && day.key > todayKey;
  const barPercent = (day: DayStat) => (day.focusMs / (axis.maxMinutes * 60_000)) * 100;
  const describeDay = (day: DayStat) =>
    `${fullDate.format(day.start)}: ${formatFocus(day.focusMs)}, ${day.sessionCount} ${day.sessionCount === 1 ? "session" : "sessions"}`;

  return (
    <section aria-labelledby={headingId} className="flex w-full max-w-sm flex-col gap-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-sm font-medium">
            {heading}
          </h2>
          <p className="text-xs text-foreground/60">{rangeLabel}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="size-11 rounded-full text-lg hover:bg-foreground/5"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset === 0}
            className="size-11 rounded-full text-lg hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ›
          </button>
        </div>
      </div>

      {/* Stat tiles: the headline numbers. Proportional figures, not tabular, at this size. */}
      {/* The first tile holds the longest value ("12 h 45 min"), so it gets more room. */}
      <dl className="grid grid-cols-[1.5fr_1fr_1fr] gap-2 sm:gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-foreground/10 px-3 py-2">
          <dt className="text-xs text-foreground/60">Focus time</dt>
          <dd className="whitespace-nowrap text-base font-semibold sm:text-lg">{formatFocus(stats.totalMs)}</dd>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-foreground/10 px-3 py-2">
          <dt className="text-xs text-foreground/60">Sessions</dt>
          <dd className="whitespace-nowrap text-base font-semibold sm:text-lg">{stats.sessionCount}</dd>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-foreground/10 px-3 py-2">
          <dt className="text-xs text-foreground/60">Best day</dt>
          <dd className="whitespace-nowrap text-base font-semibold sm:text-lg">{stats.bestDay ? dayName.format(stats.bestDay.start) : "–"}</dd>
        </div>
      </dl>

      {stats.totalMs === 0 && (
        <p className="text-sm text-foreground/60">
          {weekOffset === 0 ? "No focus sessions this week yet." : "No focus sessions that week."}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-foreground/5"
        >
          {view === "chart" ? "Show as table" : "Show as chart"}
        </button>
      </div>

      {view === "table" ? (
        <table className="w-full text-sm">
          <caption className="sr-only">
            Focus per day, {rangeLabel}
          </caption>
          <thead>
            <tr className="text-left text-xs text-foreground/60">
              <th scope="col" className="py-1 font-medium">
                Day
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Focus
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Sessions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {stats.days.map((day) => (
              <tr key={day.key}>
                <th scope="row" className="py-1.5 text-left font-normal">
                  {fullDate.format(day.start)}
                  {day.key === todayKey && <span className="text-foreground/60"> (today)</span>}
                </th>
                <td className="py-1.5 text-right tabular-nums">{formatFocus(day.focusMs)}</td>
                <td className="py-1.5 text-right tabular-nums">{day.sessionCount}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-foreground/20 font-medium">
              <th scope="row" className="py-1.5 text-left">
                Total
              </th>
              <td className="py-1.5 text-right tabular-nums">{formatFocus(stats.totalMs)}</td>
              <td className="py-1.5 text-right tabular-nums">{stats.sessionCount}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <figure className="flex flex-col gap-2">
          <div className="flex gap-2">
            {/* Y-axis tick labels, aligned to the gridlines. */}
            <div aria-hidden="true" className="relative w-10 shrink-0" style={{ height: PLOT_HEIGHT_PX }}>
              {axis.ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute right-0 translate-y-1/2 text-[10px] tabular-nums text-foreground/50"
                  style={{ bottom: `${(tick / axis.maxMinutes) * 100}%` }}
                >
                  {formatFocus(tick * 60_000)}
                </span>
              ))}
            </div>

            <div className="relative flex-1" style={{ height: PLOT_HEIGHT_PX }}>
              {/* Gridlines: solid hairlines, one step off the background. */}
              {axis.ticks.map((tick) => (
                <div
                  key={tick}
                  aria-hidden="true"
                  className={`absolute inset-x-0 h-px ${tick === 0 ? "bg-foreground/25" : "bg-foreground/10"}`}
                  style={{ bottom: `${(tick / axis.maxMinutes) * 100}%` }}
                />
              ))}

              <ol className="absolute inset-0 grid grid-cols-7" aria-label={`Focus per day, ${rangeLabel}`}>
                {stats.days.map((day, i) => {
                  const percent = barPercent(day);
                  const isBest = stats.bestDay?.key === day.key;
                  const isActive = activeDay === i;
                  return (
                    // The whole column is the hover/focus target, much bigger than the thin bar.
                    <li
                      key={day.key}
                      tabIndex={0}
                      aria-label={describeDay(day)}
                      onPointerEnter={() => setActiveDay(i)}
                      onPointerLeave={() => setActiveDay((a) => (a === i ? null : a))}
                      onFocus={() => setActiveDay(i)}
                      onBlur={() => setActiveDay((a) => (a === i ? null : a))}
                      className={`relative flex items-end justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${isActive ? "bg-foreground/5" : ""}`}
                    >
                      {day.focusMs > 0 && (
                        <div
                          data-testid="bar"
                          // At most 24px wide; rounded at the data end, square at the baseline.
                          className={`w-5 rounded-t-[4px] bg-chart-series transition-[filter] ${isActive ? "brightness-110" : ""}`}
                          style={{ height: `${percent}%`, minHeight: 2 }}
                        />
                      )}
                      {/* Label only the peak. The axis, tooltip and table carry the rest. */}
                      {isBest && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute whitespace-nowrap text-[10px] font-medium text-foreground/70"
                          style={{ bottom: `calc(${percent}% + 4px)` }}
                        >
                          {formatFocus(day.focusMs)}
                        </span>
                      )}
                      {isActive && (
                        <div
                          role="tooltip"
                          className={`pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg border border-foreground/10 bg-background px-2.5 py-1.5 text-left shadow-sm ${i === 0 ? "left-0" : i === 6 ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                        >
                          {/* Value first and strongest; the label follows. */}
                          <span className="block text-sm font-semibold">{formatFocus(day.focusMs)}</span>
                          <span className="block text-xs text-foreground/60">
                            {fullDate.format(day.start)} · {day.sessionCount}{" "}
                            {day.sessionCount === 1 ? "session" : "sessions"}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* X-axis: weekday names. Today is emphasised; future days recede. */}
          <div aria-hidden="true" className="flex gap-2">
            <div className="w-10 shrink-0" />
            <div className="grid flex-1 grid-cols-7">
              {stats.days.map((day) => (
                <span
                  key={day.key}
                  className={`text-center text-[11px] ${
                    day.key === todayKey
                      ? "font-semibold text-foreground"
                      : isFuture(day)
                        ? "text-foreground/30"
                        : "text-foreground/60"
                  }`}
                >
                  {dayName.format(day.start)}
                </span>
              ))}
            </div>
          </div>
        </figure>
      )}
    </section>
  );
}
