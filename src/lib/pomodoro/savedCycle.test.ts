/**
 * @jest-environment node
 */
import { createPomodoro, pomodoroReducer } from "./pomodoro";
import { cycleToSave, parseCycle, serializeCycle, type SavedCycle } from "./savedCycle";
import { DEFAULT_SETTINGS } from "./settings";

const MIN = 60_000;
const T0 = 1_000_000_000_000;

const running: SavedCycle = {
  phase: "focus",
  completedFocus: 2,
  timer: { status: "running", durationMs: 25 * MIN, startedAt: T0, elapsedBeforeMs: 0 },
  phaseStartedAt: T0,
};

describe("cycleToSave", () => {
  it("keeps the phase, cycle position, timer and start time, but not settings or completions", () => {
    const state = pomodoroReducer(createPomodoro(DEFAULT_SETTINGS), { type: "start", now: T0 });

    expect(cycleToSave(state)).toEqual({
      phase: "focus",
      completedFocus: 0,
      timer: { status: "running", durationMs: 25 * MIN, startedAt: T0, elapsedBeforeMs: 0 },
      phaseStartedAt: T0,
    });
  });
});

describe("parseCycle", () => {
  it("returns null when nothing was saved", () => {
    expect(parseCycle(null)).toBeNull();
  });

  it.each<[string, SavedCycle]>([
    ["a running timer", running],
    ["a paused timer", { ...running, timer: { status: "paused", durationMs: 25 * MIN, elapsedMs: 7 * MIN } }],
    ["an idle break", { phase: "longBreak", completedFocus: 4, timer: { status: "idle", durationMs: 15 * MIN }, phaseStartedAt: null }],
  ])("reads back %s", (_label, cycle) => {
    expect(parseCycle(serializeCycle(cycle))).toEqual(cycle);
  });

  it.each([
    ["broken JSON", "{nope"],
    ["an unknown version", JSON.stringify({ version: 2, cycle: running })],
    ["no cycle", JSON.stringify({ version: 1 })],
    ["an unknown phase", serializeCycle({ ...running, phase: "nap" as never })],
    ["a negative session count", serializeCycle({ ...running, completedFocus: -1 })],
    ["a fractional session count", serializeCycle({ ...running, completedFocus: 1.5 })],
    ["a running timer with no start time", JSON.stringify({ version: 1, cycle: { ...running, timer: { status: "running", durationMs: 25 * MIN, elapsedBeforeMs: 0 } } })],
    ["more time used than the timer has", serializeCycle({ ...running, timer: { status: "paused", durationMs: 25 * MIN, elapsedMs: 26 * MIN } })],
    ["a zero-length timer", serializeCycle({ ...running, timer: { status: "idle", durationMs: 0 } })],
    ["a finished timer (never saved by the app)", serializeCycle({ ...running, timer: { status: "finished", durationMs: 25 * MIN, finishedAt: T0 } })],
    ["a text start time", JSON.stringify({ version: 1, cycle: { ...running, phaseStartedAt: "09:00" } })],
  ])("rejects %s", (_label, raw) => {
    expect(parseCycle(raw)).toBeNull();
  });
});
