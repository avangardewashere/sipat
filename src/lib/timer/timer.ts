/**
 * The timer engine: pure logic with no React, no setInterval, and no Date.now().
 *
 * The key idea: we never count down ("remaining -= 1 every second"). Browsers throttle
 * timers in background tabs and freeze them when a laptop sleeps, so a counter drifts.
 * Instead we store *when* the timer started and work out the remaining time from the
 * clock whenever someone asks. However late or rarely a tick arrives, the answer is right.
 *
 * Every function takes the current time (`now`, in milliseconds) as an argument instead
 * of reading the clock itself. That keeps the engine pure, so tests can say
 * "it is now 10 minutes later" without waiting 10 minutes.
 */

export type TimerState =
  | { status: "idle"; durationMs: number }
  | {
      status: "running";
      durationMs: number;
      /** When the current run started. After a resume, this is the resume time. */
      startedAt: number;
      /** Time already used up by earlier runs, before the last pause. */
      elapsedBeforeMs: number;
    }
  | { status: "paused"; durationMs: number; elapsedMs: number }
  | {
      status: "finished";
      durationMs: number;
      /** The moment the time actually ran out, even if nobody noticed until later. */
      finishedAt: number;
    };

export type TimerStatus = TimerState["status"];

export type TimerAction =
  | { type: "start"; now: number }
  | { type: "pause"; now: number }
  | { type: "tick"; now: number }
  | { type: "reset" };

export function createTimer(durationMs: number): TimerState {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError(`Timer duration must be a positive number of ms, got ${durationMs}`);
  }
  return { status: "idle", durationMs };
}

export function getElapsedMs(state: TimerState, now: number): number {
  switch (state.status) {
    case "idle":
      return 0;
    case "paused":
      return state.elapsedMs;
    case "finished":
      return state.durationMs;
    case "running": {
      // Math.max: if the system clock is moved backwards, don't give the user extra time.
      const thisRunMs = Math.max(0, now - state.startedAt);
      return Math.min(state.durationMs, state.elapsedBeforeMs + thisRunMs);
    }
  }
}

export function getRemainingMs(state: TimerState, now: number): number {
  return state.durationMs - getElapsedMs(state, now);
}

/**
 * Every change to a timer goes through here, the same pattern Habibit used. It plugs
 * straight into React's useReducer in Block 2.
 *
 * When nothing changes, the reducer returns the *same object*. React uses that to skip a
 * re-render, and tests use it to prove an action was ignored.
 */
export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "start":
      if (state.status === "idle") {
        return { status: "running", durationMs: state.durationMs, startedAt: action.now, elapsedBeforeMs: 0 };
      }
      if (state.status === "paused") {
        return {
          status: "running",
          durationMs: state.durationMs,
          startedAt: action.now,
          elapsedBeforeMs: state.elapsedMs,
        };
      }
      // Already running: nothing to do. Finished: you have to reset before starting again.
      return state;

    case "pause": {
      if (state.status !== "running") return state;
      // If the time ran out before the pause arrived, the timer is finished, not paused.
      const synced = timerReducer(state, { type: "tick", now: action.now });
      if (synced.status === "finished") return synced;
      return { status: "paused", durationMs: state.durationMs, elapsedMs: getElapsedMs(state, action.now) };
    }

    case "tick": {
      if (state.status !== "running") return state;
      if (getRemainingMs(state, action.now) > 0) return state;
      return {
        status: "finished",
        durationMs: state.durationMs,
        // The real end time, worked out from the start, not the (possibly late) moment of this tick.
        finishedAt: state.startedAt + (state.durationMs - state.elapsedBeforeMs),
      };
    }

    case "reset":
      if (state.status === "idle") return state;
      return { status: "idle", durationMs: state.durationMs };

    default: {
      // If a new action type is added and not handled above, TypeScript flags this line.
      const unhandled: never = action;
      throw new Error(`Unknown timer action: ${JSON.stringify(unhandled)}`);
    }
  }
}
