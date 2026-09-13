/**
 * @jest-environment node
 */
import type { PhaseCompletion } from "@/lib/pomodoro/pomodoro";
import {
  formatSession,
  mergeSessions,
  parseSessions,
  serializeSessions,
  sessionFromCompletion,
  type FocusSession,
} from "./session";

const MIN = 60_000;
// 14 Sep 2026, 09:00 in the test timezone (UTC+8, set in jest.config.ts).
const NINE_AM = new Date(2026, 8, 14, 9, 0).getTime();

function session(overrides: Partial<FocusSession> = {}): FocusSession {
  const endedAt = overrides.endedAt ?? NINE_AM + 25 * MIN;
  return { id: `focus-${endedAt}`, startedAt: NINE_AM, endedAt, durationMs: 25 * MIN, ...overrides };
}

it("runs in UTC+8, so date tests mean the same thing everywhere", () => {
  expect(new Date(NINE_AM).getTimezoneOffset()).toBe(-8 * 60);
});

describe("sessionFromCompletion", () => {
  const completion: PhaseCompletion = {
    seq: 3,
    phase: "focus",
    durationMs: 25 * MIN,
    startedAt: NINE_AM,
    finishedAt: NINE_AM + 25 * MIN,
  };

  it("turns a completed focus phase into a session", () => {
    expect(sessionFromCompletion(completion)).toEqual({
      id: `focus-${NINE_AM + 25 * MIN}`,
      startedAt: NINE_AM,
      endedAt: NINE_AM + 25 * MIN,
      durationMs: 25 * MIN,
    });
  });

  it("gives the same id for the same completion, whatever its seq number", () => {
    // seq starts over on every page load; the end time doesn't.
    expect(sessionFromCompletion({ ...completion, seq: 1 })?.id).toBe(sessionFromCompletion(completion)?.id);
  });

  it("ignores breaks", () => {
    expect(sessionFromCompletion({ ...completion, phase: "shortBreak" })).toBeNull();
    expect(sessionFromCompletion({ ...completion, phase: "longBreak" })).toBeNull();
  });
});

describe("mergeSessions", () => {
  it("sorts oldest first and keeps one copy of each id", () => {
    const early = session({ endedAt: NINE_AM + 25 * MIN });
    const late = session({ endedAt: NINE_AM + 60 * MIN });

    expect(mergeSessions([late], [early, late])).toEqual([early, late]);
  });
});

describe("parseSessions", () => {
  it("treats nothing saved as an empty log", () => {
    expect(parseSessions(null)).toEqual({ sessions: [], hadUnreadableData: false });
  });

  it("reads back what serializeSessions wrote", () => {
    const sessions = [session(), session({ endedAt: NINE_AM + 90 * MIN })];

    expect(parseSessions(serializeSessions(sessions))).toEqual({ sessions, hadUnreadableData: false });
  });

  it.each([
    ["broken JSON", "{not json"],
    ["an unknown format version", JSON.stringify({ version: 99, sessions: [] })],
    ["a bare array", JSON.stringify([])],
    ["null", "null"],
  ])("flags %s as unreadable", (_label, raw) => {
    expect(parseSessions(raw)).toEqual({ sessions: [], hadUnreadableData: true });
  });

  it("keeps the good entries and flags the bad ones", () => {
    const good = session();
    const raw = JSON.stringify({
      version: 1,
      sessions: [good, { id: "x" }, { ...good, id: "negative", durationMs: -1 }, "nonsense"],
    });

    expect(parseSessions(raw)).toEqual({ sessions: [good], hadUnreadableData: true });
  });
});

describe("formatSession", () => {
  it("shows the day, the local start–end time and the focus minutes", () => {
    expect(formatSession(session(), "en-US")).toEqual({
      date: "Mon, Sep 14",
      timeRange: "09:00–09:25",
      minutes: "25 min",
    });
  });

  it("uses 24-hour times for the evening", () => {
    const evening = new Date(2026, 8, 14, 21, 5).getTime();

    expect(formatSession(session({ startedAt: evening, endedAt: evening + 25 * MIN }), "en-US").timeRange).toBe(
      "21:05–21:30",
    );
  });

  it("shows the full span when the session was paused, but only the focus minutes", () => {
    const paused = session({ startedAt: NINE_AM, endedAt: NINE_AM + 55 * MIN, durationMs: 25 * MIN });

    expect(formatSession(paused, "en-US")).toMatchObject({ timeRange: "09:00–09:55", minutes: "25 min" });
  });
});
