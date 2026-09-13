import { DEFAULT_SETTINGS, SETTING_FIELDS, type PomodoroSettings, type SettingKey } from "./settings";

/** Everything the user chooses that should survive a refresh. */
export type Preferences = {
  settings: PomodoroSettings;
  soundOn: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = { settings: DEFAULT_SETTINGS, soundOn: true };

const PREFERENCES_FORMAT_VERSION = 1;

/**
 * Reads saved preferences. Returns null when nothing was ever saved, so the app keeps whatever
 * it started with.
 *
 * Forgiving on purpose: one bad field (edited by hand, or from an older version) falls back to
 * its default without throwing away the other fields.
 */
export function parsePreferences(raw: string | null): Preferences | null {
  if (raw === null) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  const stored = data as { version?: unknown; settings?: unknown; soundOn?: unknown };
  if (stored.version !== PREFERENCES_FORMAT_VERSION) return null;

  const storedSettings = (typeof stored.settings === "object" && stored.settings !== null
    ? stored.settings
    : {}) as Record<string, unknown>;

  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(SETTING_FIELDS) as SettingKey[]) {
    const value = storedSettings[key];
    const { min, max } = SETTING_FIELDS[key];
    if (Number.isInteger(value) && (value as number) >= min && (value as number) <= max) {
      settings[key] = value as number;
    }
  }

  return {
    settings,
    soundOn: typeof stored.soundOn === "boolean" ? stored.soundOn : DEFAULT_PREFERENCES.soundOn,
  };
}

export function serializePreferences(preferences: Preferences): string {
  return JSON.stringify({ version: PREFERENCES_FORMAT_VERSION, ...preferences });
}
