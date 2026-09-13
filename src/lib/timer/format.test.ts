/**
 * @jest-environment node
 */
import { formatRemaining } from "./format";

const SEC = 1_000;
const MIN = 60 * SEC;

describe("formatRemaining", () => {
  it.each([
    [25 * MIN, "25:00"],
    [5 * MIN + 7 * SEC, "05:07"],
    [59 * SEC, "00:59"],
    [0, "00:00"],
    [90 * MIN, "90:00"], // minutes keep counting past 59; no hours column
    [100 * MIN, "100:00"],
  ])("formats %p ms as %p", (ms, expected) => {
    expect(formatRemaining(ms)).toBe(expected);
  });

  it("rounds up partial seconds, so a just-started 25-minute timer still reads 25:00", () => {
    expect(formatRemaining(25 * MIN - 1)).toBe("25:00");
    expect(formatRemaining(24 * MIN + 59 * SEC + 1)).toBe("25:00");
    expect(formatRemaining(24 * MIN + 59 * SEC)).toBe("24:59");
  });

  it("only shows 00:00 when no time is left at all", () => {
    expect(formatRemaining(1)).toBe("00:01");
    expect(formatRemaining(0)).toBe("00:00");
  });

  it("treats negative input as zero", () => {
    expect(formatRemaining(-5 * SEC)).toBe("00:00");
  });
});
