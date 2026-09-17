"use client";

import { useEffect, useEffectEvent } from "react";
import type { Preferences } from "@/lib/pomodoro/preferences";
import type { SavedCycle } from "@/lib/pomodoro/savedCycle";
import type { FocusSession } from "@/lib/sessions/session";
import type { SipatRepository } from "@/lib/storage/repository";

export type StoredData = {
  preferences: Preferences | null;
  sessions: FocusSession[];
  cycle: SavedCycle | null;
};

/**
 * Loads saved preferences, sessions and the timer's cycle once, after the component mounts, and
 * hands them to `onLoaded`.
 *
 * Why after mount: the server pre-renders the page without any browser storage, and the first
 * render in the browser must match that HTML exactly (hydration). So the page starts with
 * defaults and switches to saved data a moment later.
 */
export function useStoredData(repository: SipatRepository, onLoaded: (data: StoredData) => void) {
  const handleLoaded = useEffectEvent(onLoaded);

  useEffect(() => {
    // If the component unmounts before loading finishes, ignore the result.
    let cancelled = false;

    Promise.all([repository.loadPreferences(), repository.loadSessions(), repository.loadCycle()])
      .then(([preferences, sessions, cycle]) => {
        if (!cancelled) handleLoaded({ preferences, sessions, cycle });
      })
      .catch(() => {
        // A repository that can't load still leaves a working timer, just without history.
        if (!cancelled) handleLoaded({ preferences: null, sessions: [], cycle: null });
      });

    return () => {
      cancelled = true;
    };
  }, [repository]);
}
