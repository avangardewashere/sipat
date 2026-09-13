/**
 * @jest-environment node
 */
import { getRemainingMs } from "@/lib/timer/timer";
import {
  completionMessage,
  createPomodoro,
  filledDots,
  pomodoroReducer,
  sessionNumber,
  type PomodoroAction,
  type PomodoroState,
} from "./pomodoro";
import { DEFAULT_SETTINGS, type Phase } from "./settings";

const SEC = 1_000;
const MIN = 60 * SEC;
const T0 = 1_000_000_000_000;

function run(state: PomodoroState, ...actions: PomodoroAction[]): PomodoroState {
  return actions.reduce(pomodoroReducer, state);
}

/** Start the current phase at `now` and let it run to zero. */
function completePhase(state: PomodoroState, now: number): PomodoroState {
  return run(state, { type: "start", now }, { type: "tick", now: now + state.timer.durationMs });
}

describe("starting out", () => {
  it("begins with an idle 25-minute focus, session 1 of 4", () => {
    const state = createPomodoro(DEFAULT_SETTINGS);

    expect(state.phase).toBe("focus");
    expect(state.timer).toEqual({ status: "idle", durationMs: 25 * MIN });
    expect(sessionNumber(state)).toBe(1);
    expect(filledDots(state)).toBe(0);
    expect(state.lastCompletion).toBeNull();
  });
});

describe("completing a phase", () => {
  it("moves from focus to a short break, ready but not started", () => {
    const state = completePhase(createPomodoro(DEFAULT_SETTINGS), T0);

    expect(state.phase).toBe("shortBreak");
    expect(state.timer).toEqual({ status: "idle", durationMs: 5 * MIN });
    expect(state.completedFocus).toBe(1);
    expect(filledDots(state)).toBe(1);
  });

  it("records the completion with the real end time", () => {
    // The tick arrives an hour late (laptop asleep), but finishedAt is still exact.
    const state = run(createPomodoro(DEFAULT_SETTINGS), { type: "start", now: T0 }, { type: "tick", now: T0 + 90 * MIN });

    expect(state.lastCompletion).toEqual({
      seq: 1,
      phase: "focus",
      durationMs: 25 * MIN,
      startedAt: T0,
      finishedAt: T0 + 25 * MIN,
    });
  });

  it("keeps the first start time through pauses, so a session's span includes its breaks", () => {
    const state = run(
      createPomodoro(DEFAULT_SETTINGS),
      { type: "start", now: T0 },
      { type: "pause", now: T0 + 10 * MIN },
      { type: "start", now: T0 + 40 * MIN }, // resumed half an hour later
      { type: "tick", now: T0 + 55 * MIN },
    );

    expect(state.lastCompletion).toMatchObject({ startedAt: T0, finishedAt: T0 + 55 * MIN, durationMs: 25 * MIN });
  });

  it("forgets the start time on reset, so the next start counts from then", () => {
    const state = run(
      createPomodoro(DEFAULT_SETTINGS),
      { type: "start", now: T0 },
      { type: "reset" },
      { type: "start", now: T0 + 60 * MIN },
      { type: "tick", now: T0 + 85 * MIN },
    );

    expect(state.lastCompletion).toMatchObject({ startedAt: T0 + 60 * MIN });
  });

  it("moves from a break back to focus", () => {
    let state = completePhase(createPomodoro(DEFAULT_SETTINGS), T0);
    state = completePhase(state, T0 + 30 * MIN);

    expect(state.phase).toBe("focus");
    expect(state.timer).toEqual({ status: "idle", durationMs: 25 * MIN });
    expect(sessionNumber(state)).toBe(2);
    expect(state.lastCompletion).toMatchObject({ seq: 2, phase: "shortBreak" });
  });

  it("also completes when a pause arrives after time already ran out", () => {
    const state = run(createPomodoro(DEFAULT_SETTINGS), { type: "start", now: T0 }, { type: "pause", now: T0 + 26 * MIN });

    expect(state.phase).toBe("shortBreak");
    expect(state.lastCompletion).toMatchObject({ phase: "focus", finishedAt: T0 + 25 * MIN });
  });

  it("returns the same state for a tick before time is up", () => {
    const running = run(createPomodoro(DEFAULT_SETTINGS), { type: "start", now: T0 });

    expect(pomodoroReducer(running, { type: "tick", now: T0 + 10 * MIN })).toBe(running);
  });
});

describe("the full cycle", () => {
  it("gives a long break after every 4th focus session, then starts over", () => {
    let state = createPomodoro(DEFAULT_SETTINGS);
    const phases: Phase[] = [state.phase];
    let now = T0;

    for (let i = 0; i < 9; i++) {
      state = completePhase(state, now);
      now += 60 * MIN;
      phases.push(state.phase);
    }

    expect(phases).toEqual([
      "focus", "shortBreak",
      "focus", "shortBreak",
      "focus", "shortBreak",
      "focus", "longBreak",
      "focus", "shortBreak",
    ]);
  });

  it("gives the long break its own length and fills every dot", () => {
    let state = createPomodoro(DEFAULT_SETTINGS);
    for (let i = 0; i < 7; i++) state = completePhase(state, T0 + i * 60 * MIN);

    expect(state.phase).toBe("longBreak");
    expect(state.timer.durationMs).toBe(15 * MIN);
    expect(filledDots(state)).toBe(4);
  });

  it("counts sessions 1 to 4 and back to 1 after the long break", () => {
    let state = createPomodoro(DEFAULT_SETTINGS);
    const sessions: number[] = [];
    let now = T0;

    for (let i = 0; i < 5; i++) {
      sessions.push(sessionNumber(state));
      state = completePhase(state, now); // focus
      state = completePhase(state, now + 30 * MIN); // break
      now += 60 * MIN;
    }

    expect(sessions).toEqual([1, 2, 3, 4, 1]);
  });

  it("follows a custom cycle length", () => {
    let state = createPomodoro({ ...DEFAULT_SETTINGS, longBreakEvery: 2 });
    const phases: Phase[] = [];
    for (let i = 0; i < 4; i++) {
      state = completePhase(state, T0 + i * 60 * MIN);
      phases.push(state.phase);
    }

    expect(phases).toEqual(["shortBreak", "focus", "longBreak", "focus"]);
  });
});

describe("skip", () => {
  it("moves from focus to a short break without counting the session", () => {
    const state = run(createPomodoro(DEFAULT_SETTINGS), { type: "skip" });

    expect(state.phase).toBe("shortBreak");
    expect(state.completedFocus).toBe(0);
    expect(state.lastCompletion).toBeNull();
  });

  it("discards progress when skipping a running phase", () => {
    const state = run(createPomodoro(DEFAULT_SETTINGS), { type: "start", now: T0 }, { type: "skip" });

    expect(state.timer).toEqual({ status: "idle", durationMs: 5 * MIN });
  });

  it("never earns a long break by skipping the 4th focus", () => {
    let state = createPomodoro(DEFAULT_SETTINGS);
    for (let i = 0; i < 6; i++) state = completePhase(state, T0 + i * 60 * MIN); // 3 focus + 3 breaks

    state = run(state, { type: "skip" });

    expect(state.phase).toBe("shortBreak");
  });

  it("moves from a break back to focus", () => {
    const state = run(createPomodoro(DEFAULT_SETTINGS), { type: "skip" }, { type: "skip" });

    expect(state.phase).toBe("focus");
  });
});

describe("reset", () => {
  it("restarts the current phase without changing phase", () => {
    let state = completePhase(createPomodoro(DEFAULT_SETTINGS), T0); // now on a short break
    state = run(state, { type: "start", now: T0 + 30 * MIN }, { type: "reset" });

    expect(state.phase).toBe("shortBreak");
    expect(state.timer).toEqual({ status: "idle", durationMs: 5 * MIN });
    expect(state.completedFocus).toBe(1);
  });
});

describe("changing settings", () => {
  const longer = { ...DEFAULT_SETTINGS, focusMin: 50, shortBreakMin: 10 };

  it("applies straight away to a phase that hasn't started", () => {
    const state = run(createPomodoro(DEFAULT_SETTINGS), { type: "updateSettings", settings: longer });

    expect(state.timer).toEqual({ status: "idle", durationMs: 50 * MIN });
  });

  it("leaves a running phase alone and applies from the next phase", () => {
    let state = run(
      createPomodoro(DEFAULT_SETTINGS),
      { type: "start", now: T0 },
      { type: "updateSettings", settings: longer },
    );

    expect(state.timer.durationMs).toBe(25 * MIN);
    expect(getRemainingMs(state.timer, T0 + 5 * MIN)).toBe(20 * MIN);

    state = run(state, { type: "tick", now: T0 + 25 * MIN });
    expect(state.timer.durationMs).toBe(10 * MIN);
  });

  it("leaves a paused phase alone too", () => {
    const state = run(
      createPomodoro(DEFAULT_SETTINGS),
      { type: "start", now: T0 },
      { type: "pause", now: T0 + 5 * MIN },
      { type: "updateSettings", settings: longer },
    );

    expect(state.timer).toEqual({ status: "paused", durationMs: 25 * MIN, elapsedMs: 5 * MIN });
  });
});

describe("completionMessage", () => {
  it("announces the break that's coming, with its length", () => {
    expect(completionMessage("focus", "shortBreak", DEFAULT_SETTINGS)).toEqual({
      title: "Focus session done",
      body: "Time for a 5-minute break.",
    });
    expect(completionMessage("focus", "longBreak", DEFAULT_SETTINGS)).toEqual({
      title: "Focus session done",
      body: "Time for a 15-minute long break.",
    });
  });

  it("invites you back to focus after a break", () => {
    expect(completionMessage("longBreak", "focus", DEFAULT_SETTINGS)).toEqual({
      title: "Break's over",
      body: "Ready for 25 minutes of focus?",
    });
  });
});
