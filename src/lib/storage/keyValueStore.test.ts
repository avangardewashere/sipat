import { createLocalStorageStore, createMemoryStore } from "./keyValueStore";

describe("memory store", () => {
  it("gets, sets and removes values", () => {
    const store = createMemoryStore({ a: "1" });

    expect(store.get("a")).toBe("1");
    expect(store.get("missing")).toBeNull();
    expect(store.set("b", "2")).toBe(true);
    expect(store.get("b")).toBe("2");
    store.remove("a");
    expect(store.get("a")).toBeNull();
  });
});

describe("localStorage store", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("reads and writes the browser's localStorage", () => {
    const store = createLocalStorageStore();

    expect(store.set("sipat:test", "hello")).toBe(true);
    expect(window.localStorage.getItem("sipat:test")).toBe("hello");
    expect(store.get("sipat:test")).toBe("hello");
    store.remove("sipat:test");
    expect(window.localStorage.getItem("sipat:test")).toBeNull();
  });

  it("reports a failed write instead of throwing when storage is full", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    expect(createLocalStorageStore().set("key", "value")).toBe(false);
  });

  it("acts empty and never throws when the browser blocks site data", () => {
    // In that situation even *reading* window.localStorage throws.
    jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Access is denied", "SecurityError");
    });
    const store = createLocalStorageStore();

    expect(store.get("key")).toBeNull();
    expect(store.set("key", "value")).toBe(false);
    expect(() => store.remove("key")).not.toThrow();
  });
});
