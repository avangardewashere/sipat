/**
 * The part of the Pomodoro state that survives a refresh: which phase you're in, how far through
 * the cycle you are, and the timer itself.
 *
 * Not saved here: settings (already saved as preferences) and `lastCompletion` (an in-memory
 * signal for effects, not data).
 *
 * The timer is saved exactly as the engine holds it: a start *timestamp*, not "minutes left". That's
 * why restoring works: a timer started at 09:00 and restored at 09:07 simply shows 18 minutes left,
 * with no catching up to do. Block 1's design choice pays off here.
 */

import type { TimerState } from "@/lib/timer/timer";
import type { PomodoroState } from "./pomodoro";
import type { Phase } from "./settings";

export type SavedCycle = {
  phase: Phase;
  completedFocus: number;
  timer: TimerState;
  phaseStartedAt: number | null;
};

const CYCLE_FORMAT_VERSION = 1;
const PHASES: readonly Phase[] = ["focus", "shortBreak", "longBreak"];

export function cycleToSave(state: PomodoroState): SavedCycle {
  return {
    phase: state.phase,
    completedFocus: state.completedFocus,
    timer: state.timer,
    phaseStartedAt: state.phaseStartedAt,
  };
}

export function serializeCycle(cycle: SavedCycle): string {
  return JSON.stringify({ version: CYCLE_FORMAT_VERSION, cycle });
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Only a timer the engine could really have produced is accepted. A half-valid timer (say, running
 * but with no start time) would show nonsense, so it's rejected as a whole.
 * "finished" is never saved: a finished phase immediately becomes the next, idle one.
 */
function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  if (!isNumber(t.durationMs) || t.durationMs <= 0) return false;

  switch (t.status) {
    case "idle":
      return true;
    case "running":
      return isNumber(t.startedAt) && isNumber(t.elapsedBeforeMs) && t.elapsedBeforeMs >= 0 && t.elapsedBeforeMs <= t.durationMs;
    case "paused":
      return isNumber(t.elapsedMs) && t.elapsedMs >= 0 && t.elapsedMs <= t.durationMs;
    default:
      return false;
  }
}

/**
 * Reads the saved cycle, or null if there's nothing usable (never saved, unreadable, or from an
 * unknown version). Null simply means "start fresh".
 *
 * Unlike sessions (Block 4), unreadable timer state is NOT backed up. Sessions are your history;
 * this is a timer that was running. Losing it costs at most one unfinished session.
 */
export function parseCycle(raw: string | null): SavedCycle | null {
  if (raw === null) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const envelope = data as { version?: unknown; cycle?: unknown } | null;
  if (!envelope || envelope.version !== CYCLE_FORMAT_VERSION) return null;
  if (typeof envelope.cycle !== "object" || envelope.cycle === null) return null;

  const c = envelope.cycle as Record<string, unknown>;
  const phaseStartedAt = c.phaseStartedAt;
  if (
    !PHASES.includes(c.phase as Phase) ||
    !Number.isInteger(c.completedFocus) ||
    (c.completedFocus as number) < 0 ||
    !isTimerState(c.timer) ||
    !(phaseStartedAt === null || isNumber(phaseStartedAt))
  ) {
    return null;
  }

  return {
    phase: c.phase as Phase,
    completedFocus: c.completedFocus as number,
    timer: c.timer,
    phaseStartedAt: phaseStartedAt as number | null,
  };
}
