export type Phase = "focus" | "shortBreak" | "longBreak";

export type PomodoroSettings = {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  /** A long break comes after every N-th completed focus session. */
  longBreakEvery: number;
};

export type SettingKey = keyof PomodoroSettings;

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
};

export const SETTING_FIELDS: Record<SettingKey, { label: string; unit: string; min: number; max: number }> = {
  focusMin: { label: "Focus", unit: "min", min: 1, max: 180 },
  shortBreakMin: { label: "Short break", unit: "min", min: 1, max: 60 },
  longBreakMin: { label: "Long break", unit: "min", min: 1, max: 60 },
  longBreakEvery: { label: "Long break after", unit: "sessions", min: 2, max: 12 },
};

export const PHASE_LABEL: Record<Phase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

export function phaseDurationMs(phase: Phase, settings: PomodoroSettings): number {
  const minutes = {
    focus: settings.focusMin,
    shortBreak: settings.shortBreakMin,
    longBreak: settings.longBreakMin,
  }[phase];
  return minutes * 60_000;
}

/** What the form holds: raw text exactly as typed. */
export type SettingsInput = Record<SettingKey, string>;
export type SettingsErrors = Partial<Record<SettingKey, string>>;

export function toSettingsInput(settings: PomodoroSettings): SettingsInput {
  return {
    focusMin: String(settings.focusMin),
    shortBreakMin: String(settings.shortBreakMin),
    longBreakMin: String(settings.longBreakMin),
    longBreakEvery: String(settings.longBreakEvery),
  };
}

/**
 * Turns what the user typed into valid settings, or explains what's wrong with each field.
 * Nothing is silently clamped or rounded: "2.5" or "999" is an error, not a guess.
 */
export function validateSettings(
  input: SettingsInput,
): { ok: true; settings: PomodoroSettings } | { ok: false; errors: SettingsErrors } {
  const errors: SettingsErrors = {};
  const settings = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(SETTING_FIELDS) as SettingKey[]) {
    const { min, max } = SETTING_FIELDS[key];
    const raw = input[key].trim();

    if (raw === "") {
      errors[key] = "Required";
    } else if (!/^\d+$/.test(raw)) {
      errors[key] = "Enter a whole number";
    } else if (Number(raw) < min || Number(raw) > max) {
      errors[key] = `Must be between ${min} and ${max}`;
    } else {
      settings[key] = Number(raw);
    }
  }

  return Object.keys(errors).length === 0 ? { ok: true, settings } : { ok: false, errors };
}
