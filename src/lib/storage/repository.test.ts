/**
 * @jest-environment node
 */
import { DEFAULT_PREFERENCES, parsePreferences, serializePreferences } from "@/lib/pomodoro/preferences";
import { serializeSessions, type FocusSession } from "@/lib/sessions/session";
import { createMemoryStore, type KeyValueStore } from "./keyValueStore";
import { createLocalRepository, STORAGE_KEYS, StorageWriteError } from "./repository";

const MIN = 60_000;
const T0 = 1_000_000_000_000;

function session(endedAt: number): FocusSession {
  return { id: `focus-${endedAt}`, startedAt: endedAt - 25 * MIN, endedAt, durationMs: 25 * MIN };
}

/** A store that reads fine but refuses every write, like a full or blocked localStorage. */
function readOnlyStore(initial: Record<string, string> = {}): KeyValueStore {
  return { ...createMemoryStore(initial), set: () => false };
}

describe("sessions", () => {
  it("starts with an empty log", async () => {
    const repo = createLocalRepository(createMemoryStore());

    await expect(repo.loadSessions()).resolves.toEqual([]);
  });

  it("saves sessions so a new repository on the same storage sees them (a page refresh)", async () => {
    const store = createMemoryStore();
    await createLocalRepository(store).addSession(session(T0));
    await createLocalRepository(store).addSession(session(T0 + 60 * MIN));

    await expect(createLocalRepository(store).loadSessions()).resolves.toEqual([
      session(T0),
      session(T0 + 60 * MIN),
    ]);
  });

  it("resolves with the full updated list", async () => {
    const repo = createLocalRepository(createMemoryStore());
    await repo.addSession(session(T0));

    await expect(repo.addSession(session(T0 + 60 * MIN))).resolves.toHaveLength(2);
  });

  it("never saves the same session twice", async () => {
    const store = createMemoryStore();
    const repo = createLocalRepository(store);

    await repo.addSession(session(T0));
    await repo.addSession(session(T0));

    await expect(repo.loadSessions()).resolves.toHaveLength(1);
  });

  it("keeps a session another tab saved in the meantime", async () => {
    const store = createMemoryStore();
    const tabA = createLocalRepository(store);
    const tabB = createLocalRepository(store);

    await tabA.loadSessions(); // tab A loaded an empty log earlier…
    await tabB.addSession(session(T0)); // …then tab B saved a session…
    const result = await tabA.addSession(session(T0 + 60 * MIN)); // …then tab A saves one

    expect(result).toEqual([session(T0), session(T0 + 60 * MIN)]);
  });

  it("keeps a backup of unreadable data before it can be overwritten", async () => {
    const store = createMemoryStore({ [STORAGE_KEYS.sessions]: "{corrupted" });
    const repo = createLocalRepository(store);

    await expect(repo.loadSessions()).resolves.toEqual([]);
    expect(store.get(STORAGE_KEYS.sessionsBackup)).toBe("{corrupted");

    await repo.addSession(session(T0));
    expect(store.get(STORAGE_KEYS.sessionsBackup)).toBe("{corrupted"); // still there
  });

  it("makes no backup when the data is fine", async () => {
    const store = createMemoryStore({ [STORAGE_KEYS.sessions]: serializeSessions([session(T0)]) });

    await createLocalRepository(store).loadSessions();

    expect(store.get(STORAGE_KEYS.sessionsBackup)).toBeNull();
  });

  it("rejects with StorageWriteError when the browser won't save", async () => {
    const repo = createLocalRepository(readOnlyStore());

    await expect(repo.addSession(session(T0))).rejects.toBeInstanceOf(StorageWriteError);
  });
});

describe("preferences", () => {
  it("resolves null when nothing was ever saved", async () => {
    await expect(createLocalRepository(createMemoryStore()).loadPreferences()).resolves.toBeNull();
  });

  it("saves and loads preferences", async () => {
    const store = createMemoryStore();
    const preferences = {
      settings: { focusMin: 50, shortBreakMin: 10, longBreakMin: 20, longBreakEvery: 3 },
      soundOn: false,
    };

    await createLocalRepository(store).savePreferences(preferences);

    await expect(createLocalRepository(store).loadPreferences()).resolves.toEqual(preferences);
  });

  it("rejects with StorageWriteError when the browser won't save", async () => {
    await expect(createLocalRepository(readOnlyStore()).savePreferences(DEFAULT_PREFERENCES)).rejects.toBeInstanceOf(
      StorageWriteError,
    );
  });
});

describe("parsePreferences", () => {
  it.each([
    ["broken JSON", "{nope"],
    ["an unknown version", JSON.stringify({ version: 7, settings: {}, soundOn: false })],
    ["a non-object", "42"],
  ])("returns null for %s", (_label, raw) => {
    expect(parsePreferences(raw)).toBeNull();
  });

  it("replaces only the invalid fields with defaults", () => {
    const raw = JSON.stringify({
      version: 1,
      settings: { focusMin: 45, shortBreakMin: 0, longBreakMin: "15", longBreakEvery: 3 },
      soundOn: "yes",
    });

    expect(parsePreferences(raw)).toEqual({
      settings: { focusMin: 45, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 3 },
      soundOn: true,
    });
  });

  it("round-trips through serializePreferences", () => {
    const preferences = { settings: { ...DEFAULT_PREFERENCES.settings, focusMin: 90 }, soundOn: false };

    expect(parsePreferences(serializePreferences(preferences))).toEqual(preferences);
  });
});
