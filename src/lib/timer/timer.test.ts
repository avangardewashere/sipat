/**
 * @jest-environment node
 */
// The engine never touches the DOM, so it runs in plain Node instead of jsdom (faster).

import {
  createTimer,
  getElapsedMs,
  getRemainingMs,
  timerReducer,
  type TimerAction,
  type TimerState,
} from "./timer";

const SEC = 1_000;
const MIN = 60 * SEC;
/** An arbitrary fixed "now". Tests never read the real clock. */
const T0 = 1_000_000_000_000;

/** Apply several actions in order, like a user clicking buttons over time. */
function run(state: TimerState, ...actions: TimerAction[]): TimerState {
  return actions.reduce(timerReducer, state);
}

describe("createTimer", () => {
  it("starts idle with the full duration remaining", () => {
    const timer = createTimer(25 * MIN);

    expect(timer).toEqual({ status: "idle", durationMs: 25 * MIN });
    expect(getRemainingMs(timer, T0)).toBe(25 * MIN);
  });

  it.each([0, -5 * MIN, NaN, Infinity])("rejects an invalid duration (%p)", (bad) => {
    expect(() => createTimer(bad)).toThrow(RangeError);
  });
});

describe("start", () => {
  it("counts down from the moment it starts", () => {
    const timer = run(createTimer(25 * MIN), { type: "start", now: T0 });

    expect(timer.status).toBe("running");
    expect(getRemainingMs(timer, T0)).toBe(25 * MIN);
    expect(getRemainingMs(timer, T0 + 10 * SEC)).toBe(25 * MIN - 10 * SEC);
  });

  it("ignores start while already running (the countdown is not restarted)", () => {
    const running = run(createTimer(25 * MIN), { type: "start", now: T0 });

    const afterSecondStart = timerReducer(running, { type: "start", now: T0 + 5 * MIN });

    expect(afterSecondStart).toBe(running);
  });

  it("ignores start once finished (you must reset first)", () => {
    const finished = run(createTimer(1 * MIN), { type: "start", now: T0 }, { type: "tick", now: T0 + 1 * MIN });

    expect(timerReducer(finished, { type: "start", now: T0 + 2 * MIN })).toBe(finished);
  });
});

describe("pause and resume", () => {
  it("freezes the remaining time while paused", () => {
    const paused = run(createTimer(25 * MIN), { type: "start", now: T0 }, { type: "pause", now: T0 + 5 * MIN });

    expect(paused.status).toBe("paused");
    expect(getRemainingMs(paused, T0 + 5 * MIN)).toBe(20 * MIN);
    // An hour later, still exactly 20 minutes left.
    expect(getRemainingMs(paused, T0 + 65 * MIN)).toBe(20 * MIN);
  });

  it("resumes from where it paused, not from the start", () => {
    const resumed = run(
      createTimer(25 * MIN),
      { type: "start", now: T0 },
      { type: "pause", now: T0 + 5 * MIN },
      { type: "start", now: T0 + 30 * MIN }, // a 25-minute coffee break
    );

    expect(resumed.status).toBe("running");
    expect(getRemainingMs(resumed, T0 + 30 * MIN)).toBe(20 * MIN);
    expect(getRemainingMs(resumed, T0 + 31 * MIN)).toBe(19 * MIN);
  });

  it("adds up time correctly over several pause/resume cycles", () => {
    const timer = run(
      createTimer(25 * MIN),
      { type: "start", now: T0 },
      { type: "pause", now: T0 + 3 * MIN }, // ran 3 min
      { type: "start", now: T0 + 10 * MIN },
      { type: "pause", now: T0 + 14 * MIN }, // ran 4 more
      { type: "start", now: T0 + 20 * MIN },
      { type: "pause", now: T0 + 22 * MIN }, // ran 2 more
    );

    expect(getElapsedMs(timer, T0 + 99 * MIN)).toBe(9 * MIN);
    expect(getRemainingMs(timer, T0 + 99 * MIN)).toBe(16 * MIN);
  });

  it("ignores pause when the timer is not running", () => {
    const idle = createTimer(25 * MIN);
    const paused = run(idle, { type: "start", now: T0 }, { type: "pause", now: T0 + MIN });

    expect(timerReducer(idle, { type: "pause", now: T0 })).toBe(idle);
    expect(timerReducer(paused, { type: "pause", now: T0 + 2 * MIN })).toBe(paused);
  });

  it("becomes finished, not paused, if pause arrives after the time already ran out", () => {
    const timer = run(createTimer(1 * MIN), { type: "start", now: T0 }, { type: "pause", now: T0 + 5 * MIN });

    expect(timer).toEqual({ status: "finished", durationMs: 1 * MIN, finishedAt: T0 + 1 * MIN });
  });
});

describe("tick", () => {
  it("does nothing before the time is up (same object, so React skips a re-render)", () => {
    const running = run(createTimer(25 * MIN), { type: "start", now: T0 });

    expect(timerReducer(running, { type: "tick", now: T0 + 24 * MIN + 59 * SEC })).toBe(running);
  });

  it("finishes exactly when the time is up", () => {
    const timer = run(createTimer(25 * MIN), { type: "start", now: T0 }, { type: "tick", now: T0 + 25 * MIN });

    expect(timer).toEqual({ status: "finished", durationMs: 25 * MIN, finishedAt: T0 + 25 * MIN });
    expect(getRemainingMs(timer, T0 + 25 * MIN)).toBe(0);
  });

  it("records the real end time even when the tick arrives much later", () => {
    // The laptop slept, and the first tick after waking comes 2 hours in.
    const timer = run(createTimer(25 * MIN), { type: "start", now: T0 }, { type: "tick", now: T0 + 120 * MIN });

    expect(timer.status).toBe("finished");
    expect(timer.status === "finished" && timer.finishedAt).toBe(T0 + 25 * MIN);
  });

  it("includes paused time when working out the real end time", () => {
    const timer = run(
      createTimer(25 * MIN),
      { type: "start", now: T0 },
      { type: "pause", now: T0 + 10 * MIN }, // 15 min left
      { type: "start", now: T0 + 40 * MIN }, // resumed 30 min later
      { type: "tick", now: T0 + 90 * MIN },
    );

    expect(timer.status === "finished" && timer.finishedAt).toBe(T0 + 55 * MIN);
  });

  it("ignores ticks when idle or paused", () => {
    const idle = createTimer(MIN);
    const paused = run(idle, { type: "start", now: T0 }, { type: "pause", now: T0 + 30 * SEC });

    expect(timerReducer(idle, { type: "tick", now: T0 + 99 * MIN })).toBe(idle);
    expect(timerReducer(paused, { type: "tick", now: T0 + 99 * MIN })).toBe(paused);
  });
});

describe("reset", () => {
  it.each<[string, TimerAction[]]>([
    ["running", [{ type: "start", now: T0 }]],
    ["paused", [{ type: "start", now: T0 }, { type: "pause", now: T0 + MIN }]],
    ["finished", [{ type: "start", now: T0 }, { type: "tick", now: T0 + 25 * MIN }]],
  ])("returns a %s timer to idle with the same duration", (_label, actions) => {
    const timer = run(createTimer(25 * MIN), ...actions, { type: "reset" });

    expect(timer).toEqual({ status: "idle", durationMs: 25 * MIN });
  });

  it("does nothing to an idle timer", () => {
    const idle = createTimer(25 * MIN);

    expect(timerReducer(idle, { type: "reset" })).toBe(idle);
  });
});

describe("remaining time stays within bounds", () => {
  it("never goes below zero, even long after the deadline", () => {
    const running = run(createTimer(1 * MIN), { type: "start", now: T0 });

    expect(getRemainingMs(running, T0 + 999 * MIN)).toBe(0);
  });

  it("never gives extra time if the system clock jumps backwards", () => {
    const running = run(createTimer(25 * MIN), { type: "start", now: T0 });

    expect(getRemainingMs(running, T0 - 60 * MIN)).toBe(25 * MIN);
  });
});
