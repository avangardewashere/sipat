"use client";

import { useEffect } from "react";

/**
 * Sets the browser tab's title, and puts the previous title back when the component unmounts.
 *
 * Kept separate from the Timer on purpose: the Timer decides *what* the title says, and this
 * hook owns the side effect of writing it. Either one can be swapped without touching the other.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
