/**
 * @jest-environment node
 */
import {
  DEFAULT_SETTINGS,
  phaseDurationMs,
  toSettingsInput,
  validateSettings,
  type SettingsInput,
} from "./settings";

const valid: SettingsInput = toSettingsInput(DEFAULT_SETTINGS);

describe("phaseDurationMs", () => {
  it("converts each phase's minutes to milliseconds", () => {
    expect(phaseDurationMs("focus", DEFAULT_SETTINGS)).toBe(25 * 60_000);
    expect(phaseDurationMs("shortBreak", DEFAULT_SETTINGS)).toBe(5 * 60_000);
    expect(phaseDurationMs("longBreak", DEFAULT_SETTINGS)).toBe(15 * 60_000);
  });
});

describe("validateSettings", () => {
  it("accepts valid input and turns it into numbers", () => {
    const result = validateSettings({ focusMin: "50", shortBreakMin: "10", longBreakMin: "30", longBreakEvery: "3" });

    expect(result).toEqual({
      ok: true,
      settings: { focusMin: 50, shortBreakMin: 10, longBreakMin: 30, longBreakEvery: 3 },
    });
  });

  it("ignores surrounding spaces", () => {
    expect(validateSettings({ ...valid, focusMin: " 30 " })).toMatchObject({ ok: true, settings: { focusMin: 30 } });
  });

  it("accepts the smallest and largest allowed values", () => {
    expect(validateSettings({ focusMin: "1", shortBreakMin: "1", longBreakMin: "1", longBreakEvery: "2" }).ok).toBe(true);
    expect(validateSettings({ focusMin: "180", shortBreakMin: "60", longBreakMin: "60", longBreakEvery: "12" }).ok).toBe(
      true,
    );
  });

  it.each([
    ["", "Required"],
    ["   ", "Required"],
    ["abc", "Enter a whole number"],
    ["2.5", "Enter a whole number"],
    ["-5", "Enter a whole number"],
    ["0", "Must be between 1 and 180"],
    ["181", "Must be between 1 and 180"],
  ])("rejects focus length %p with %p", (raw, message) => {
    expect(validateSettings({ ...valid, focusMin: raw })).toEqual({ ok: false, errors: { focusMin: message } });
  });

  it("rejects a long break after fewer than 2 sessions (every break would be long)", () => {
    expect(validateSettings({ ...valid, longBreakEvery: "1" })).toEqual({
      ok: false,
      errors: { longBreakEvery: "Must be between 2 and 12" },
    });
  });

  it("reports every invalid field at once, not just the first", () => {
    const result = validateSettings({ focusMin: "0", shortBreakMin: "x", longBreakMin: "15", longBreakEvery: "" });

    expect(result).toEqual({
      ok: false,
      errors: { focusMin: "Must be between 1 and 180", shortBreakMin: "Enter a whole number", longBreakEvery: "Required" },
    });
  });
});
