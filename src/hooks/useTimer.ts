"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { createTimer, getRemainingMs, timerReducer, type TimerStatus } from "@/lib/timer/timer";

export type UseTimerOptions = {
  /** Where the current time comes from. Swappable, but keep it a stable reference. */
  clock?: () => number;
  /** How often the display refreshes while running. */
  refreshMs?: number;
};

export type UseTimer = {
  status: TimerStatus;
  remainingMs: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
};

/**
 * Connects the pure Block 1 engine to React.
 *
 * The engine decides *what* the time is. This hook only decides *when to look again*:
 * a short interval while running, plus an immediate look when a hidden tab becomes
 * visible again. A late or skipped refresh never changes the answer, only how
 * fresh the display is.
 */
export function useTimer(
  durationMs: number,
  { clock = Date.now, refreshMs = 250 }: UseTimerOptions = {},
): UseTimer {
  const [state, dispatch] = useReducer(timerReducer, durationMs, createTimer);
  // Passing a function to useState makes React call it once for the first value: clock().
  const [now, setNow] = useState(clock);

  const isRunning = state.status === "running";

  useEffect(() => {
    // No interval at all unless the timer is running: an idle timer costs nothing.
    if (!isRunning) return;

    const refresh = () => {
      const t = clock();
      setNow(t);
      dispatch({ type: "tick", now: t });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const id = setInterval(refresh, refreshMs);
    document.addEventListener("visibilitychange", onVisibilityChange);
    // Cleanup runs on pause, finish or unmount, so intervals never pile up or leak.
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isRunning, clock, refreshMs]);

  const start = useCallback(() => {
    const t = clock();
    setNow(t);
    dispatch({ type: "start", now: t });
  }, [clock]);

  const pause = useCallback(() => {
    const t = clock();
    setNow(t);
    dispatch({ type: "pause", now: t });
  }, [clock]);

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { status: state.status, remainingMs: getRemainingMs(state, now), start, pause, reset };
}
