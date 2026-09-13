"use client";

import { useEffect, useRef } from "react";

/**
 * Sets the browser tab's title, keeps it set, and puts the previous title back on unmount.
 *
 * "Keeps it set" matters: Next.js manages its own <title> from `metadata`, and in a real browser
 * that title finished hydrating *after* our first write and silently replaced it (Jest's jsdom
 * has no Next.js head, so tests never saw this). A MutationObserver watches <head> and writes
 * our title back whenever something else changes it.
 *
 * Kept separate from the Timer on purpose: the Timer decides *what* the title says, and this
 * hook owns the side effect of writing it.
 */
export function useDocumentTitle(title: string) {
  const latestTitle = useRef(title);

  // Declared first, so it runs first and records the title from before we touched it.
  useEffect(() => {
    const previous = document.title;
    const observer = new MutationObserver(() => {
      // Writing the title triggers the observer again, but then they match and it stops.
      if (document.title !== latestTitle.current) document.title = latestTitle.current;
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    latestTitle.current = title;
    document.title = title;
  }, [title]);
}
