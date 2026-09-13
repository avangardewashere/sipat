"use client";

import { useId, useState, type FormEvent } from "react";
import {
  SETTING_FIELDS,
  toSettingsInput,
  validateSettings,
  type PomodoroSettings,
  type SettingKey,
  type SettingsErrors,
  type SettingsInput,
} from "@/lib/pomodoro/settings";

type Props = {
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
  /** True while a phase is running or paused, so edits only apply from the next phase. */
  phaseInProgress: boolean;
  soundOn: boolean;
  onSoundChange: (on: boolean) => void;
  notifyOn: boolean;
  onNotifyChange: (on: boolean) => void;
  notice: string | null;
};

const FIELD_ORDER: SettingKey[] = ["focusMin", "shortBreakMin", "longBreakMin", "longBreakEvery"];

export function SettingsPanel({
  settings,
  onSave,
  phaseInProgress,
  soundOn,
  onSoundChange,
  notifyOn,
  onNotifyChange,
  notice,
}: Props) {
  const idPrefix = useId();
  // The form edits a *draft* of raw text. Nothing reaches the timer until it's valid and saved.
  const [draft, setDraft] = useState<SettingsInput>(() => toSettingsInput(settings));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateSettings(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setSaved(false);
      return;
    }
    setErrors({});
    setSaved(true);
    onSave(result.settings);
  }

  return (
    <details className="w-full max-w-sm rounded-2xl border border-foreground/10 text-left open:bg-foreground/[0.03]">
      <summary className="cursor-pointer select-none rounded-2xl px-5 py-3 text-sm font-medium">Settings</summary>

      <div className="flex flex-col gap-6 px-5 pb-5 pt-2">
        {/* noValidate: our own validation runs instead of the browser's, so every browser
            shows the same clear messages. */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {FIELD_ORDER.map((key) => {
              const field = SETTING_FIELDS[key];
              const inputId = `${idPrefix}-${key}`;
              const errorId = `${inputId}-error`;
              return (
                <div key={key} className="flex flex-col gap-1">
                  <label htmlFor={inputId} className="text-xs font-medium text-foreground/70">
                    {field.label} ({field.unit})
                  </label>
                  <input
                    id={inputId}
                    name={key}
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    step={1}
                    value={draft[key]}
                    onChange={(e) => {
                      setDraft({ ...draft, [key]: e.target.value });
                      setSaved(false);
                    }}
                    aria-invalid={errors[key] ? true : undefined}
                    aria-describedby={errors[key] ? errorId : undefined}
                    className="h-11 rounded-lg border border-foreground/20 bg-transparent px-3 text-base tabular-nums aria-invalid:border-red-500"
                  />
                  {errors[key] && (
                    <p id={errorId} className="text-xs text-red-500">
                      {errors[key]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {phaseInProgress && (
            <p className="text-xs text-foreground/60">The current phase keeps its length. Changes apply from the next phase.</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
            >
              Save
            </button>
            <p role="status" className="text-sm text-foreground/60">
              {saved ? "Saved" : ""}
            </p>
          </div>
        </form>

        <fieldset className="flex flex-col gap-3 border-t border-foreground/10 pt-4">
          <legend className="sr-only">When time is up</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={soundOn}
              onChange={(e) => onSoundChange(e.target.checked)}
              className="size-5"
            />
            Sound and vibration
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={notifyOn}
              onChange={(e) => onNotifyChange(e.target.checked)}
              className="size-5"
            />
            System notification
          </label>
          {notice && (
            <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">
              {notice}
            </p>
          )}
        </fieldset>
      </div>
    </details>
  );
}
