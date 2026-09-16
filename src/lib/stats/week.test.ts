/**
 * @jest-environment node
 */
import type { FocusSession } from "@/lib/sessions/session";
import {
  addLocalDays,
  formatFocus,
  localDayKey,
  niceAxis,
  startOfLocalDay,
  startOfLocalWeek,
  weekStats,
} from "./week";

const MIN = 60_000;

/** Local time in the test timezone. Month is 1-based here, to read like a calendar. */
function at(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function session(startedAt: number, endedAt: number, durationMs = endedAt - startedAt): FocusSession {
  return { id: `focus-${endedAt}`, startedAt, endedAt, durationMs };
}

// Week of Mon 14 – Sun 20 September 2026, UTC+8 (see jest.config.ts).
const MON = at(2026, 9, 14);

describe("local days and weeks", () => {
  it("finds Monday 00:00 for any moment in the week", () => {
    expect(startOfLocalWeek(at(2026, 9, 16, 14, 30))).toBe(MON); // Wednesday afternoon
    expect(startOfLocalWeek(MON)).toBe(MON); // Monday midnight itself
    expect(startOfLocalWeek(at(2026, 9, 20, 23, 59))).toBe(MON); // the last minute of Sunday
    expect(startOfLocalWeek(at(2026, 9, 21, 0, 0))).toBe(at(2026, 9, 21)); // next Monday
  });

  it("handles weeks that cross a month or a year", () => {
    expect(startOfLocalWeek(at(2026, 10, 2))).toBe(at(2026, 9, 28)); // Fri 2 Oct → Mon 28 Sep
    expect(startOfLocalWeek(at(2027, 1, 1))).toBe(at(2026, 12, 28)); // Fri 1 Jan → Mon 28 Dec
  });

  it("builds day keys from local parts, not UTC (the toISOString bug at UTC+8)", () => {
    const earlyMorning = at(2026, 9, 15, 7, 30); // 07:30 in Manila is 23:30 the previous day in UTC

    expect(new Date(earlyMorning).toISOString().slice(0, 10)).toBe("2026-09-14"); // the trap
    expect(localDayKey(earlyMorning)).toBe("2026-09-15"); // the right answer
  });

  it("steps whole local days", () => {
    expect(addLocalDays(at(2026, 9, 30, 18), 1)).toBe(at(2026, 10, 1));
    expect(startOfLocalDay(at(2026, 9, 14, 23, 59))).toBe(MON);
  });
});

describe("weekStats", () => {
  it("adds up focus and sessions per day", () => {
    const stats = weekStats(
      [
        session(at(2026, 9, 14, 9, 0), at(2026, 9, 14, 9, 25)), // Mon
        session(at(2026, 9, 14, 10, 0), at(2026, 9, 14, 10, 25)), // Mon
        session(at(2026, 9, 16, 15, 0), at(2026, 9, 16, 15, 50)), // Wed, 50 min
      ],
      MON,
    );

    expect(stats.days.map((d) => d.key)).toEqual([
      "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20",
    ]);
    expect(stats.days.map((d) => d.focusMs / MIN)).toEqual([50, 0, 50, 0, 0, 0, 0]);
    expect(stats.days.map((d) => d.sessionCount)).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(stats.totalMs).toBe(100 * MIN);
    expect(stats.sessionCount).toBe(3);
  });

  it("picks the best day, and the earlier one on a tie", () => {
    const stats = weekStats(
      [
        session(at(2026, 9, 14, 9), at(2026, 9, 14, 9, 50)),
        session(at(2026, 9, 16, 9), at(2026, 9, 16, 9, 50)),
        session(at(2026, 9, 15, 9), at(2026, 9, 15, 9, 25)),
      ],
      MON,
    );

    expect(stats.bestDay?.key).toBe("2026-09-14");
  });

  it("ignores sessions from other weeks", () => {
    const stats = weekStats(
      [
        session(at(2026, 9, 13, 9), at(2026, 9, 13, 9, 25)), // the Sunday before
        session(at(2026, 9, 21, 9), at(2026, 9, 21, 9, 25)), // the Monday after
      ],
      MON,
    );

    expect(stats.totalMs).toBe(0);
    expect(stats.sessionCount).toBe(0);
    expect(stats.bestDay).toBeNull();
  });

  it("splits a session that crosses midnight between the two days", () => {
    const stats = weekStats([session(at(2026, 9, 15, 23, 50), at(2026, 9, 16, 0, 15))], MON);

    expect(stats.days[1].focusMs).toBe(10 * MIN); // Tue: 23:50–24:00
    expect(stats.days[2].focusMs).toBe(15 * MIN); // Wed: 00:00–00:15
    expect(stats.days[1].sessionCount).toBe(0);
    expect(stats.days[2].sessionCount).toBe(1); // counted on the day it ended
  });

  it("spreads a paused session's focus evenly over its span", () => {
    // 23:30 → 00:30 is one hour of span, but only 30 minutes of focus (it was paused).
    const stats = weekStats([session(at(2026, 9, 15, 23, 30), at(2026, 9, 16, 0, 30), 30 * MIN)], MON);

    expect(stats.days[1].focusMs).toBe(15 * MIN);
    expect(stats.days[2].focusMs).toBe(15 * MIN);
    expect(stats.totalMs).toBe(30 * MIN);
  });

  it("puts a session that ends exactly at midnight entirely on the day before", () => {
    const stats = weekStats([session(at(2026, 9, 15, 23, 35), at(2026, 9, 16, 0, 0))], MON);

    expect(stats.days[1]).toMatchObject({ focusMs: 25 * MIN, sessionCount: 1 });
    expect(stats.days[2]).toMatchObject({ focusMs: 0, sessionCount: 0 });
  });

  it("splits a session across two weeks, counting it in the week it ended", () => {
    const crossing = session(at(2026, 9, 20, 23, 50), at(2026, 9, 21, 0, 15)); // Sun night → Mon

    const thisWeek = weekStats([crossing], MON);
    const nextWeek = weekStats([crossing], at(2026, 9, 21));

    expect(thisWeek).toMatchObject({ totalMs: 10 * MIN, sessionCount: 0 });
    expect(nextWeek).toMatchObject({ totalMs: 15 * MIN, sessionCount: 1 });
  });
});
// Daylight saving is tested in week.dst.test.ts, which runs in a New York process (npm run test:dst).

describe("formatFocus", () => {
  it.each([
    [0, "0 min"],
    [25 * MIN, "25 min"],
    [59 * MIN + 29_000, "59 min"],
    [59 * MIN + 31_000, "1 h"],
    [60 * MIN, "1 h"],
    [125 * MIN, "2 h 5 min"],
  ])("formats %p ms as %p", (ms, text) => {
    expect(formatFocus(ms)).toBe(text);
  });
});

describe("niceAxis", () => {
  it.each([
    [0, 60, [0, 30, 60]],
    [25, 30, [0, 10, 20, 30]],
    [50, 60, [0, 15, 30, 45, 60]],
    [100, 120, [0, 30, 60, 90, 120]],
    [400, 480, [0, 120, 240, 360, 480]],
    [2000, 2880, [0, 960, 1920, 2880]],
  ])("a tallest day of %p min gives a %p-minute axis", (maxMin, top, ticks) => {
    expect(niceAxis(maxMin * MIN)).toEqual({ maxMinutes: top, ticks });
  });
});
