import { shortcutFor, type KeyInput } from "./shortcuts";

function key(k: string, overrides: Partial<KeyInput> = {}): KeyInput {
  return { key: k, repeat: false, ctrlKey: false, metaKey: false, altKey: false, target: document.body, ...overrides };
}

describe("shortcutFor", () => {
  it.each([
    [" ", "toggle"],
    ["r", "reset"],
    ["R", "reset"],
    ["s", "skip"],
    ["S", "skip"],
  ])("maps %p to %p", (k, action) => {
    expect(shortcutFor(key(k))).toBe(action);
  });

  it("ignores other keys", () => {
    expect(shortcutFor(key("Enter"))).toBeNull();
    expect(shortcutFor(key("x"))).toBeNull();
  });

  it("leaves Ctrl, ⌘ and Alt combinations to the browser (Ctrl+R must still reload)", () => {
    expect(shortcutFor(key("r", { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(key("r", { metaKey: true }))).toBeNull();
    expect(shortcutFor(key("s", { altKey: true }))).toBeNull();
  });

  it("ignores a key held down", () => {
    expect(shortcutFor(key(" ", { repeat: true }))).toBeNull();
  });

  it.each([
    ["a text field", "<input type='text' />"],
    ["a number field", "<input type='number' />"],
    ["a checkbox", "<input type='checkbox' />"],
    ["a button (Space already clicks it)", "<button>Pause</button>"],
    ["a <summary>", "<details><summary>Settings</summary></details>"],
    ["a link", "<a href='/'>Home</a>"],
  ])("does nothing when focus is on %s", (_label, html) => {
    document.body.innerHTML = html;
    const target = document.body.querySelector("input, button, summary, a") as Element;

    expect(shortcutFor(key(" ", { target }))).toBeNull();
    expect(shortcutFor(key("r", { target }))).toBeNull();
  });

  it("still works from inside a plain element, like a focused chart column", () => {
    document.body.innerHTML = "<ol><li tabindex='0'>Mon</li></ol>";

    expect(shortcutFor(key(" ", { target: document.querySelector("li") }))).toBe("toggle");
  });
});
