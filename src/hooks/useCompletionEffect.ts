"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { PhaseCompletion } from "@/lib/pomodoro/pomodoro";

/**
 * Runs `onComplete` exactly once for each new phase completion.
 *
 * The reducer can't play sounds (it must stay pure), so it just *records* a completion with a
 * rising `seq` number. This hook notices a new one after React renders and runs the side effect.
 * The ref remembers the last handled `seq`, so a re-render or remount never replays an old chime.
 */
export function useCompletionEffect(
  completion: PhaseCompletion | null,
  onComplete: (completion: PhaseCompletion) => void,
) {
  const lastHandledSeq = useRef(completion?.seq ?? 0);

  // useEffectEvent always sees the latest props and state, without making the effect below
  // re-run every time `onComplete` is a new function.
  const handle = useEffectEvent(onComplete);

  useEffect(() => {
    if (!completion || completion.seq <= lastHandledSeq.current) return;
    lastHandledSeq.current = completion.seq;
    handle(completion);
  }, [completion]);
}
