/**
 * The Pomodoro cycle: focus → short break → focus → … → long break after every N-th focus.
 *
 * Built *on top of* the Block 1 timer engine, not by changing it. This reducer owns the
 * sequence of phases. Each phase gets its own plain timer, and timing is still handled
 * entirely by timerReducer.
 */

import { createTimer, timerReducer, type TimerState } from "@/lib/timer/timer";
import { phaseDurationMs, type Phase, type PomodoroSettings } from "./settings";

/** Recorded whenever a phase runs all the way to zero (skipping doesn't count). */
export type PhaseCompletion = {
  /** Goes up by one per completion, so effects can tell a new one from one already handled. */
  seq: number;
  phase: Phase;
  durationMs: number;
  /** The real moment time ran out (see Block 1). */
  finishedAt: number;
};

export type PomodoroState = {
  settings: PomodoroSettings;
  phase: Phase;
  /** Focus sessions run to completion since the app opened. */
  completedFocus: number;
  timer: TimerState;
  lastCompletion: PhaseCompletion | null;
};

export type PomodoroAction =
  | { type: "start"; now: number }
  | { type: "pause"; now: number }
  | { type: "tick"; now: number }
  | { type: "reset" }
  | { type: "skip" }
  | { type: "updateSettings"; settings: PomodoroSettings };

export function createPomodoro(settings: PomodoroSettings): PomodoroState {
  return {
    settings,
    phase: "focus",
    completedFocus: 0,
    timer: createTimer(phaseDurationMs("focus", settings)),
    lastCompletion: null,
  };
}

/** Moves to the next phase, ready but NOT started: the user decides when a break begins. */
function advance(state: PomodoroState, completed: boolean): PomodoroState {
  const { settings } = state;
  let completedFocus = state.completedFocus;
  let next: Phase;

  if (state.phase === "focus") {
    if (completed) completedFocus += 1;
    // Only a *completed* focus can earn a long break; skipping your way there doesn't.
    next = completed && completedFocus % settings.longBreakEvery === 0 ? "longBreak" : "shortBreak";
  } else {
    next = "focus";
  }

  return { ...state, phase: next, completedFocus, timer: createTimer(phaseDurationMs(next, settings)) };
}

export function pomodoroReducer(state: PomodoroState, action: PomodoroAction): PomodoroState {
  switch (action.type) {
    case "start":
    case "pause":
    case "tick":
    case "reset": {
      const timer = timerReducer(state.timer, action);
      if (timer === state.timer) return state;

      if (timer.status === "finished") {
        const completion: PhaseCompletion = {
          seq: (state.lastCompletion?.seq ?? 0) + 1,
          phase: state.phase,
          durationMs: timer.durationMs,
          finishedAt: timer.finishedAt,
        };
        return { ...advance(state, true), lastCompletion: completion };
      }
      return { ...state, timer };
    }

    case "skip":
      return advance(state, false);

    case "updateSettings": {
      const { settings } = action;
      // A phase that hasn't started picks up its new length straight away. One that's
      // running or paused keeps the length it started with; the new lengths apply next phase.
      const timer =
        state.timer.status === "idle" ? createTimer(phaseDurationMs(state.phase, settings)) : state.timer;
      return { ...state, settings, timer };
    }

    default: {
      const unhandled: never = action;
      throw new Error(`Unknown pomodoro action: ${JSON.stringify(unhandled)}`);
    }
  }
}

/** "Session N of M", shown during focus. */
export function sessionNumber(state: PomodoroState): number {
  return (state.completedFocus % state.settings.longBreakEvery) + 1;
}

/** How many progress dots are filled. During a long break the whole cycle counts as done. */
export function filledDots(state: PomodoroState): number {
  if (state.phase === "longBreak") return state.settings.longBreakEvery;
  return state.completedFocus % state.settings.longBreakEvery;
}

/** The words for the notification when a phase completes. `next` is the phase that follows. */
export function completionMessage(
  completed: Phase,
  next: Phase,
  settings: PomodoroSettings,
): { title: string; body: string } {
  if (completed === "focus") {
    const breakMin = next === "longBreak" ? settings.longBreakMin : settings.shortBreakMin;
    const kind = next === "longBreak" ? "long break" : "break";
    return { title: "Focus session done", body: `Time for a ${breakMin}-minute ${kind}.` };
  }
  return { title: "Break's over", body: `Ready for ${settings.focusMin} minutes of focus?` };
}
