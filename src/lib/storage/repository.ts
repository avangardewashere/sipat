/**
 * The repository is the only thing the app talks to about saved data.
 *
 *   UI ──► SipatRepository ──► KeyValueStore ──► localStorage
 *            (what to save)      (where)
 *
 * Every method returns a Promise even though localStorage answers instantly. A real database
 * (the v2 idea) answers over the network, and making the app wait for promises *now* means
 * swapping in that database later only means writing a new repository. No UI changes.
 */

import {
  parsePreferences,
  serializePreferences,
  type Preferences,
} from "@/lib/pomodoro/preferences";
import {
  mergeSessions,
  parseSessions,
  serializeSessions,
  type FocusSession,
} from "@/lib/sessions/session";
import { createLocalStorageStore, type KeyValueStore } from "./keyValueStore";

export type SipatRepository = {
  loadSessions(): Promise<FocusSession[]>;
  /** Saves one session and resolves with the full, up-to-date list. */
  addSession(session: FocusSession): Promise<FocusSession[]>;
  /** Resolves null when nothing has been saved yet. */
  loadPreferences(): Promise<Preferences | null>;
  savePreferences(preferences: Preferences): Promise<void>;
};

/** Thrown (as a rejected Promise) when the browser refuses to store data. */
export class StorageWriteError extends Error {
  constructor(what: string) {
    super(`Could not save ${what}`);
    this.name = "StorageWriteError";
  }
}

export const STORAGE_KEYS = {
  sessions: "sipat:v1:sessions",
  /** Where unreadable session data is copied before it gets overwritten. */
  sessionsBackup: "sipat:v1:sessions:backup",
  preferences: "sipat:v1:preferences",
} as const;

export function createLocalRepository(store: KeyValueStore): SipatRepository {
  function readSessions(): FocusSession[] {
    const raw = store.get(STORAGE_KEYS.sessions);
    const { sessions, hadUnreadableData } = parseSessions(raw);
    // Never silently destroy data we don't understand: keep a copy of the original text.
    if (hadUnreadableData && raw !== null) store.set(STORAGE_KEYS.sessionsBackup, raw);
    return sessions;
  }

  return {
    async loadSessions() {
      return readSessions();
    },

    async addSession(session) {
      // Read fresh right before writing, instead of trusting a list loaded earlier.
      // If another tab saved a session in the meantime, it's kept, not overwritten.
      const current = readSessions();
      const next = mergeSessions(current, [session]);
      if (next.length === current.length) return current; // already saved

      if (!store.set(STORAGE_KEYS.sessions, serializeSessions(next))) {
        throw new StorageWriteError("session");
      }
      return next;
    },

    async loadPreferences() {
      return parsePreferences(store.get(STORAGE_KEYS.preferences));
    },

    async savePreferences(preferences) {
      if (!store.set(STORAGE_KEYS.preferences, serializePreferences(preferences))) {
        throw new StorageWriteError("preferences");
      }
    },
  };
}

/** The app's real repository: this browser's localStorage. */
export const browserRepository: SipatRepository = createLocalRepository(createLocalStorageStore());
