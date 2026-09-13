/**
 * The lowest storage layer: a place to keep strings by key. Nothing above this knows whether
 * the strings live in localStorage, in memory, or somewhere else.
 *
 * Methods never throw. localStorage can fail in ordinary situations (private browsing, storage
 * full, blocked cookies), and a timer shouldn't crash because of it. `set` returns false instead.
 */
export type KeyValueStore = {
  get(key: string): string | null;
  /** Returns false if the value couldn't be saved. */
  set(key: string, value: string): boolean;
  remove(key: string): void;
};

/** Keeps values in a Map. Used by tests, and a stand-in anywhere real storage isn't wanted. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
      return true;
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}

/**
 * Wraps the browser's localStorage. It's looked up on every call, not when this is created,
 * so the module is safe to import during server rendering, where there's no window.
 */
export function createLocalStorageStore(): KeyValueStore {
  function storage(): Storage | null {
    try {
      // Merely *reading* window.localStorage throws a SecurityError when site data is blocked.
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  return {
    get(key) {
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      const s = storage();
      if (!s) return false;
      try {
        s.setItem(key, value);
        return true;
      } catch {
        // QuotaExceededError: storage is full.
        return false;
      }
    },
    remove(key) {
      try {
        storage()?.removeItem(key);
      } catch {
        // Nothing useful to do.
      }
    },
  };
}
