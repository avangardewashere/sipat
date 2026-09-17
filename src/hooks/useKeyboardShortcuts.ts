"use client";

import { useEffect, useEffectEvent } from "react";
import { shortcutFor, type ShortcutAction } from "@/lib/shortcuts/shortcuts";

/** Listens for Sipat's keyboard shortcuts on the whole page while the component is mounted. */
export function useKeyboardShortcuts(onShortcut: (action: ShortcutAction) => void) {
  const handle = useEffectEvent(onShortcut);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = shortcutFor(event);
      if (!action) return;
      // Space would otherwise also scroll the page.
      event.preventDefault();
      handle(action);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
