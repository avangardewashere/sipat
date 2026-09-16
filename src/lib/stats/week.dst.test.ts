/**
 * @jest-environment node
 */
/**
 * Daylight saving: a local day isn't always 24 hours.
 *
 * Manila (the normal test timezone) has no daylight saving, so this file runs separately in a
 * New York process: `npm run test:dst`. Setting process.env.TZ inside a test doesn't work,
 * because Jest gives each test file its own copy of process.env, and the real process never sees
 * the change. The TZ has to be set before Jest starts (scripts/test-in-timezone.mjs does that).
 */
import type { FocusSession } from "@/lib/sessions/session";
import { addLocalDays, startOfLocalWeek, weekStats } from "./week";

const MIN = 60_000;
const HOUR = 60 * MIN;

function at(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function session(startedAt: number, endedAt: number): FocusSession {
  return { id: `focus-${endedAt}`, startedAt, endedAt, durationMs: endedAt - startedAt };
}

it("really runs in New York (otherwise every test below would pass for the wrong reason)", () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York");
  expect(new Date(at(2026, 7, 1)).getTimezoneOffset()).toBe(4 * 60); // summer, EDT
  expect(new Date(at(2026, 12, 1)).getTimezoneOffset()).toBe(5 * 60); // winter, EST
});

describe("the week clocks go back (Sun 1 Nov 2026 has 25 hours)", () => {
  const weekStart = at(2026, 10, 26); // Mon 26 Oct

  it("gives the long day its real length and ends the week at next Monday midnight", () => {
    const stats = weekStats([], weekStart);

    expect(stats.days[6].key).toBe("2026-11-01");
    expect(stats.days[6].end - stats.days[6].start).toBe(25 * HOUR);
    expect(stats.end).toBe(at(2026, 11, 2)); // not weekStart + 7 × 24 h, which is 23:00 Sunday
  });

  it("keeps a late-Sunday session in that week", () => {
    const stats = weekStats([session(at(2026, 11, 1, 23, 30), at(2026, 11, 1, 23, 55))], weekStart);

    expect(stats.days[6]).toMatchObject({ focusMs: 25 * MIN, sessionCount: 1 });
  });

  it("finds the right Monday from late on the long Sunday", () => {
    expect(startOfLocalWeek(at(2026, 11, 1, 23, 30))).toBe(weekStart);
  });
});

describe("the week clocks go forward (Sun 8 Mar 2026 has 23 hours)", () => {
  it("gives the short day its real length", () => {
    const stats = weekStats([], at(2026, 3, 2));

    expect(stats.days[6].end - stats.days[6].start).toBe(23 * HOUR);
    expect(addLocalDays(at(2026, 3, 8, 12), 1)).toBe(at(2026, 3, 9));
  });
});
