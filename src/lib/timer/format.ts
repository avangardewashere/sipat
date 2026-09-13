/**
 * Turns remaining milliseconds into the "mm:ss" shown on screen.
 *
 * Rounds UP to the next whole second, like every kitchen timer: the display shows
 * 25:00 the instant you press Start, and only reaches 00:00 when time is really up.
 * Rounding down would show 24:59 immediately and 00:00 for the whole last second.
 */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
