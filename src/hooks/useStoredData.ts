"use client";

import { useEffect, useEffectEvent } from "react";
import type { Preferences } from "@/lib/pomodoro/preferences";
import type { FocusSession } from "@/lib/sessions/session";
import type { SipatRepository } from "@/lib/storage/repository";

export type StoredData = {
  preferences: Preferences | null;
  sessions: FocusSession[];
};

/**
 * Loads saved preferences and sessions once, after the component mounts, and hands them to
 * `onLoaded`.
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

    Promise.all([repository.loadPreferences(), repository.loadSessions()])
      .then(([preferences, sessions]) => {
        if (!cancelled) handleLoaded({ preferences, sessions });
      })
      .catch(() => {
        // A repository that can't load still leaves a working timer, just without history.
        if (!cancelled) handleLoaded({ preferences: null, sessions: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [repository]);
}
