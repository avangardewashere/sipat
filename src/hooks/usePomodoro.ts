"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { createPomodoro, pomodoroReducer, type PomodoroState } from "@/lib/pomodoro/pomodoro";
import type { SavedCycle } from "@/lib/pomodoro/savedCycle";
import type { PomodoroSettings } from "@/lib/pomodoro/settings";
import { getRemainingMs } from "@/lib/timer/timer";

export type UsePomodoroOptions = {
  /** Where the current time comes from. Swappable, but keep it a stable reference. */
  clock?: () => number;
  /** How often the display refreshes while running. */
  refreshMs?: number;
};

export type UsePomodoro = {
  state: PomodoroState;
  remainingMs: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  updateSettings: (settings: PomodoroSettings) => void;
  /** Put back a cycle saved before a refresh, as of right now. */
  restore: (saved: SavedCycle) => void;
};

/**
 * Connects the pure Pomodoro reducer to React.
 *
 * The reducer decides *what* the time and phase are. This hook only decides *when to look again*:
 * a short interval while running, plus an immediate look when a hidden tab becomes visible.
 * (Same job as Block 2's useTimer, now driving the whole cycle instead of one timer.)
 */
export function usePomodoro(
  initialSettings: PomodoroSettings,
  { clock = Date.now, refreshMs = 250 }: UsePomodoroOptions = {},
): UsePomodoro {
  const [state, dispatch] = useReducer(pomodoroReducer, initialSettings, createPomodoro);
  // Passing a function to useState makes React call it once for the first value: clock().
  const [now, setNow] = useState(clock);

  const isRunning = state.timer.status === "running";

  useEffect(() => {
    // No interval at all unless a phase is running: an idle timer costs nothing.
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
    // Cleanup runs on pause, finish, skip or unmount, so intervals never pile up or leak.
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
  const skip = useCallback(() => dispatch({ type: "skip" }), []);
  const updateSettings = useCallback(
    (settings: PomodoroSettings) => dispatch({ type: "updateSettings", settings }),
    [],
  );
  const restore = useCallback(
    (saved: SavedCycle) => {
      const t = clock();
      setNow(t);
      dispatch({ type: "restore", saved, now: t });
    },
    [clock],
  );

  return { state, remainingMs: getRemainingMs(state.timer, now), start, pause, reset, skip, updateSettings, restore };
}
