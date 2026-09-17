"use client";

import { useEffect, useEffectEvent } from "react";
import type { PomodoroState } from "@/lib/pomodoro/pomodoro";
import type { SavedCycle } from "@/lib/pomodoro/savedCycle";

/**
 * Saves the timer and cycle position whenever they change, so a refresh can restore them.
 *
 * "Whenever they change" is cheaper than it sounds: ticks that change nothing return the same
 * timer object (Block 1), so a running timer is saved on start, pause, reset, skip and finish,
 * not four times a second.
 *
 * `enabled` must stay false until saved data has loaded. Otherwise the very first save would write
 * the fresh default timer over the one you had running, destroying it before it could be restored.
 */
export function useSaveCycle(state: PomodoroState, enabled: boolean, save: (cycle: SavedCycle) => void) {
  const handleSave = useEffectEvent(save);
  const { phase, completedFocus, timer, phaseStartedAt } = state;

  useEffect(() => {
    if (!enabled) return;
    handleSave({ phase, completedFocus, timer, phaseStartedAt });
  }, [enabled, phase, completedFocus, timer, phaseStartedAt]);
}
