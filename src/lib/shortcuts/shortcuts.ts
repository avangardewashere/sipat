/**
 * Keyboard shortcuts: which key does what, as a pure function so it's easy to test.
 *
 *   Space  start / pause / resume
 *   R      reset the current phase
 *   S      skip to the next phase
 */

export type ShortcutAction = "toggle" | "reset" | "skip";

/** The parts of a KeyboardEvent this needs, so tests can pass plain objects. */
export type KeyInput = {
  key: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
};

/**
 * Elements where a key already means something: typing in a field, or activating a button, link
 * or <summary>. A shortcut there would do the job twice. Pressing Space on a focused Pause button
 * must pause once, not pause and then resume.
 */
const HANDLES_ITS_OWN_KEYS = "input, textarea, select, button, summary, a[href], [contenteditable]:not([contenteditable='false'])";

export function shortcutFor(event: KeyInput): ShortcutAction | null {
  // Holding a key down sends repeats; Ctrl/⌘/Alt combinations belong to the browser (e.g. Ctrl+R).
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return null;

  const target = event.target;
  if (target instanceof Element && target.closest(HANDLES_ITS_OWN_KEYS)) return null;

  switch (event.key) {
    case " ":
      return "toggle";
    case "r":
    case "R":
      return "reset";
    case "s":
    case "S":
      return "skip";
    default:
      return null;
  }
}
