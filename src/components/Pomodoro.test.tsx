import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Alerts, PermissionResult } from "@/lib/alerts/browser";
import { DEFAULT_SETTINGS, type PomodoroSettings } from "@/lib/pomodoro/settings";
import { serializeSessions } from "@/lib/sessions/session";
import { createMemoryStore, type KeyValueStore } from "@/lib/storage/keyValueStore";
import { createLocalRepository, STORAGE_KEYS } from "@/lib/storage/repository";
import { Pomodoro } from "./Pomodoro";

const SEC = 1_000;
const MIN = 60 * SEC;

/**
 * Fake timers replace setInterval AND Date.now(), so the real hooks run unchanged
 * against a clock the test controls.
 */
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 8, 14, 9, 0, 0));
  document.title = "Sipat";
});

afterEach(() => {
  jest.useRealTimers();
});

/** Stand-ins for the browser's sound, vibration and notifications, which jsdom doesn't have. */
function fakeAlerts({ permission = "granted", notifyWorks = true }: { permission?: PermissionResult; notifyWorks?: boolean } = {}) {
  return {
    unlockSound: jest.fn(),
    chime: jest.fn(),
    vibrate: jest.fn(),
    notify: jest.fn(() => notifyWorks),
    requestNotificationPermission: jest.fn(async () => permission),
  } satisfies Alerts;
}

type SetupOptions = {
  settings?: PomodoroSettings;
  alerts?: ReturnType<typeof fakeAlerts>;
  /** Pass the same store to two setups to simulate a page refresh. */
  store?: KeyValueStore;
};

/**
 * Renders the timer with in-memory storage, then waits for saved data to finish loading,
 * like the real page does right after it appears.
 */
async function setup({ settings = DEFAULT_SETTINGS, alerts = fakeAlerts(), store = createMemoryStore() }: SetupOptions = {}) {
  // user-event waits between keystrokes/clicks; tell it to use the fake clock to do so.
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const repository = createLocalRepository(store);
  const view = render(
    <Pomodoro initialSettings={settings} alerts={alerts} repository={repository} locale="en-US" />,
  );
  await waitFor(() => expect(screen.queryByText("Loading your sessions…")).not.toBeInTheDocument());
  return { user, alerts, store, ...view };
}

/**
 * Moving time makes React state change, so it has to happen inside act(). It's async because a
 * finished focus session is saved with a Promise, and act waits for that before the test looks.
 */
async function passTime(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/**
 * How many timers are waiting. An async act() leaves one zero-delay setTimeout behind (React uses it
 * to yield), so run anything already due first; the timer's own 250 ms interval is never due at 0.
 */
function timerCount() {
  act(() => {
    jest.advanceTimersByTime(0);
  });
  return jest.getTimerCount();
}

const display = () => screen.getByRole("timer");
const phaseHeading = () =>
  within(screen.getByRole("region", { name: "Pomodoro timer" })).getByRole("heading", { level: 2 });
const sessionLog = () => screen.getByRole("region", { name: "Session log" });
const button = (name: string) => screen.getByRole("button", { name });
const queryButton = (name: string) => screen.queryByRole("button", { name });

/** Settings live in a <details> element; clicking its summary opens it. */
async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Settings"));
}

describe("before starting", () => {
  it("shows a 25-minute focus, session 1 of 4, ready to start", async () => {
    await setup();

    expect(phaseHeading()).toHaveTextContent("Focus");
    expect(display()).toHaveTextContent("25:00");
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Session 1 of 4")).toBeInTheDocument();
    expect(button("Start")).toBeEnabled();
    expect(button("Reset")).toBeDisabled();
    expect(button("Skip focus")).toBeEnabled();
    expect(queryButton("Pause")).not.toBeInTheDocument();
  });

  it("doesn't run any interval while idle", async () => {
    await setup();

    expect(timerCount()).toBe(0);
  });

  it("puts the phase in the tab title", async () => {
    await setup();

    expect(document.title).toBe("Focus · Sipat");
  });
});

describe("running", () => {
  it("counts down once started, with the time in the tab title", async () => {
    const { user } = await setup();

    await user.click(button("Start"));
    await passTime(90 * SEC);

    expect(display()).toHaveTextContent("23:30");
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(document.title).toBe("23:30 · Focus · Sipat");
  });

  it("switches sound on from the Start click (browsers require a click before audio)", async () => {
    const { user, alerts } = await setup();

    await user.click(button("Start"));

    expect(alerts.unlockSound).toHaveBeenCalledTimes(1);
  });

  it("catches up straight away when a background tab becomes visible again", async () => {
    const { user } = await setup();
    await user.click(button("Start"));

    // Hidden tab: 10 minutes pass and the interval never gets to run.
    jest.setSystemTime(Date.now() + 10 * MIN);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(display()).toHaveTextContent("15:00");
  });
});

describe("pause, resume and reset", () => {
  it("freezes while paused and continues from the same point", async () => {
    const { user } = await setup();

    await user.click(button("Start"));
    await passTime(5 * MIN);
    await user.click(button("Pause"));
    await passTime(10 * MIN);

    expect(display()).toHaveTextContent("20:00");
    expect(document.title).toBe("Paused 20:00 · Focus · Sipat");
    expect(timerCount()).toBe(0);

    await user.click(button("Resume"));
    await passTime(1 * MIN);
    expect(display()).toHaveTextContent("19:00");
  });

  it("reset returns the current phase to its full length", async () => {
    const { user } = await setup();

    await user.click(button("Start"));
    await passTime(7 * MIN);
    await user.click(button("Reset"));

    expect(display()).toHaveTextContent("25:00");
    expect(phaseHeading()).toHaveTextContent("Focus");
    expect(button("Reset")).toBeDisabled();
    expect(timerCount()).toBe(0);
  });
});

describe("when a focus session finishes", () => {
  it("moves to a short break that waits for you to start it", async () => {
    const { user } = await setup();

    await user.click(button("Start"));
    await passTime(25 * MIN);

    expect(phaseHeading()).toHaveTextContent("Short break");
    expect(display()).toHaveTextContent("05:00");
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 sessions done")).toBeInTheDocument();
    expect(button("Skip break")).toBeInTheDocument();
    expect(document.title).toBe("Short break · Sipat");
    expect(timerCount()).toBe(0);

    // Still 05:00 a minute later: breaks don't start on their own.
    await passTime(1 * MIN);
    expect(display()).toHaveTextContent("05:00");
  });

  it("plays the chime and vibrates exactly once", async () => {
    const { user, alerts } = await setup();

    await user.click(button("Start"));
    await passTime(25 * MIN);
    await passTime(5 * MIN); // more time passing must not replay it

    expect(alerts.chime).toHaveBeenCalledTimes(1);
    expect(alerts.vibrate).toHaveBeenCalledTimes(1);
  });

  it("stays silent when sound is switched off", async () => {
    const { user, alerts } = await setup();

    await openSettings(user);
    await user.click(screen.getByRole("checkbox", { name: "Sound and vibration" }));
    await user.click(button("Start"));
    await passTime(25 * MIN);

    expect(alerts.chime).not.toHaveBeenCalled();
    expect(alerts.vibrate).not.toHaveBeenCalled();
  });

  it("alerts even if the tab was hidden when time ran out", async () => {
    const { user, alerts } = await setup();
    await user.click(button("Start"));

    jest.setSystemTime(Date.now() + 40 * MIN);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(phaseHeading()).toHaveTextContent("Short break");
    expect(alerts.chime).toHaveBeenCalledTimes(1);
  });
});

describe("the full cycle", () => {
  // 1-minute phases and a long break every 2 sessions keep the test short.
  const quick: PomodoroSettings = { focusMin: 1, shortBreakMin: 1, longBreakMin: 3, longBreakEvery: 2 };

  async function completeCurrentPhase(user: ReturnType<typeof userEvent.setup>, ms: number) {
    await user.click(button("Start"));
    await passTime(ms);
  }

  it("goes focus → short break → focus → long break → focus", async () => {
    const { user } = await setup({ settings: quick });
    const seen: string[] = [phaseHeading().textContent ?? ""];

    for (const ms of [1 * MIN, 1 * MIN, 1 * MIN, 3 * MIN]) {
      await completeCurrentPhase(user, ms);
      seen.push(phaseHeading().textContent ?? "");
    }

    expect(seen).toEqual(["Focus", "Short break", "Focus", "Long break", "Focus"]);
  });

  it("shows the long break's own length and session numbers that start over", async () => {
    const { user } = await setup({ settings: quick });

    await completeCurrentPhase(user, 1 * MIN); // focus 1
    await completeCurrentPhase(user, 1 * MIN); // short break
    expect(screen.getByText("Session 2 of 2")).toBeInTheDocument();

    await completeCurrentPhase(user, 1 * MIN); // focus 2
    expect(display()).toHaveTextContent("03:00");
    expect(screen.getByText("2 of 2 sessions done")).toBeInTheDocument();

    await completeCurrentPhase(user, 3 * MIN); // long break
    expect(screen.getByText("Session 1 of 2")).toBeInTheDocument();
  });
});

describe("skip", () => {
  it("jumps to the break without counting the session or chiming", async () => {
    const { user, alerts } = await setup();

    await user.click(button("Start"));
    await passTime(3 * MIN);
    await user.click(button("Skip focus"));

    expect(phaseHeading()).toHaveTextContent("Short break");
    expect(display()).toHaveTextContent("05:00");
    expect(screen.getByText("0 of 4 sessions done")).toBeInTheDocument();
    expect(alerts.chime).not.toHaveBeenCalled();
    expect(timerCount()).toBe(0);
  });

  it("jumps from a break back to focus", async () => {
    const { user } = await setup();

    await user.click(button("Skip focus"));
    await user.click(button("Skip break"));

    expect(phaseHeading()).toHaveTextContent("Focus");
  });
});

describe("settings", () => {
  const field = (name: RegExp) => screen.getByRole("spinbutton", { name });

  it("changes the length of a phase that hasn't started", async () => {
    const { user } = await setup();

    await openSettings(user);
    await user.clear(field(/^Focus/));
    await user.type(field(/^Focus/), "50");
    await user.click(button("Save"));

    expect(display()).toHaveTextContent("50:00");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("shows a message and changes nothing when a value is invalid", async () => {
    const { user } = await setup();

    await openSettings(user);
    await user.clear(field(/^Focus/));
    await user.type(field(/^Focus/), "0");
    await user.click(button("Save"));

    expect(field(/^Focus/)).toHaveAccessibleDescription("Must be between 1 and 180");
    expect(field(/^Focus/)).toHaveAttribute("aria-invalid", "true");
    expect(display()).toHaveTextContent("25:00");
  });

  it("keeps a running phase's length and uses the new one from the next phase", async () => {
    const { user } = await setup();

    await user.click(button("Start"));
    await openSettings(user);
    expect(screen.getByText(/Changes apply from the next phase/)).toBeInTheDocument();

    await user.clear(field(/^Short break/));
    await user.type(field(/^Short break/), "10");
    await user.click(button("Save"));
    await passTime(1 * MIN);
    expect(display()).toHaveTextContent("24:00"); // unchanged: still the 25-minute focus

    await passTime(24 * MIN);
    expect(display()).toHaveTextContent("10:00"); // the break uses the new length
  });

  it("changes how many dots the cycle has", async () => {
    const { user } = await setup();

    await openSettings(user);
    await user.clear(field(/^Long break after/));
    await user.type(field(/^Long break after/), "3");
    await user.click(button("Save"));

    expect(screen.getByText("Session 1 of 3")).toBeInTheDocument();
  });
});

describe("system notifications", () => {
  const notifyBox = () => screen.getByRole<HTMLInputElement>("checkbox", { name: "System notification" });

  /**
   * Asking for permission is async: the checkbox only updates after the browser answers.
   * waitFor keeps checking (inside act) until that update has landed: the box is ticked,
   * or a notice explains why not.
   */
  async function toggleNotifications(user: ReturnType<typeof userEvent.setup>) {
    await user.click(notifyBox());
    await waitFor(() => {
      expect(notifyBox().checked || screen.queryByRole("alert") !== null).toBe(true);
    });
  }

  it("are off until you switch them on", async () => {
    const { user, alerts } = await setup();

    await user.click(button("Start"));
    await passTime(25 * MIN);

    expect(alerts.notify).not.toHaveBeenCalled();
  });

  it("ask for permission, then announce the next phase", async () => {
    const { user, alerts } = await setup();

    await openSettings(user);
    await toggleNotifications(user);
    expect(alerts.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(notifyBox()).toBeChecked();

    await user.click(button("Start"));
    await passTime(25 * MIN);

    expect(alerts.notify).toHaveBeenCalledWith("Focus session done", "Time for a 5-minute break.");
  });

  it("stay off and explain why when permission is blocked", async () => {
    const { user, alerts } = await setup({ alerts: fakeAlerts({ permission: "denied" }) });

    await openSettings(user);
    await toggleNotifications(user);

    expect(notifyBox()).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent(/blocked for this site/);

    await user.click(button("Start"));
    await passTime(25 * MIN);
    expect(alerts.notify).not.toHaveBeenCalled();
  });

  it("explain the fallback when the browser refuses to show them (Android Chrome)", async () => {
    const { user, alerts } = await setup({ alerts: fakeAlerts({ notifyWorks: false }) });

    await openSettings(user);
    await toggleNotifications(user);
    await user.click(button("Start"));
    await passTime(25 * MIN);

    expect(alerts.notify).toHaveBeenCalledTimes(1);
    expect(alerts.chime).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(/sound and vibration instead/);
  });
});

describe("keyboard", () => {
  it("can be started and paused with the keyboard alone", async () => {
    const { user } = await setup();

    await user.tab(); // focus lands on Start
    await user.keyboard("{Enter}");
    await passTime(2 * SEC);
    // Start turned into Pause in the same spot, so focus is still on it.
    await user.keyboard(" ");

    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(display()).toHaveTextContent("24:58");
  });
});

describe("unmounting", () => {
  it("clears its interval and restores the previous tab title", async () => {
    const { user, unmount } = await setup();

    await user.click(button("Start"));
    await passTime(1 * SEC);
    unmount();

    expect(timerCount()).toBe(0);
    expect(document.title).toBe("Sipat");
  });
});

describe("tab title vs. the framework", () => {
  /**
   * Found in a real browser, not by Jest: Next.js finished hydrating its own <title> after our
   * first write and replaced it. This reproduces that by overwriting the title after mount.
   */
  it("puts its title back when something else overwrites it", async () => {
    await setup();
    expect(document.title).toBe("Focus · Sipat");

    // Something outside React (like Next.js's head) replaces the <title> element.
    const replacement = document.createElement("title");
    replacement.textContent = "Sipat";
    act(() => {
      document.head.querySelectorAll("title").forEach((el) => el.remove());
      document.head.append(replacement);
    });

    // MutationObserver callbacks run as a microtask, so let one tick of promises pass.
    await act(async () => {});

    expect(document.title).toBe("Focus · Sipat");
  });

  it("stops guarding the title once unmounted", async () => {
    const { unmount } = await setup();
    unmount();

    act(() => {
      document.title = "Another page";
    });
    await act(async () => {});

    expect(document.title).toBe("Another page");
  });
});

describe("progress dots", () => {
  it("are hidden from screen readers, which get the text version instead", async () => {
    const { container } = await setup();

    const dots = container.querySelector("ol[aria-hidden]");
    expect(dots).toHaveAttribute("aria-hidden", "true");
    expect(within(dots as HTMLElement).queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("session log", () => {
  it("starts empty", async () => {
    await setup();

    expect(within(sessionLog()).getByText(/No focus sessions yet/)).toBeInTheDocument();
  });

  it("logs a completed focus session with its time and length", async () => {
    const { user } = await setup();

    await user.click(button("Start")); // 09:00 on Mon 14 Sep (fake clock, UTC+8)
    await passTime(25 * MIN);

    const entries = within(sessionLog()).getAllByRole("listitem");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toHaveTextContent("Mon, Sep 14 · 09:00–09:25");
    expect(entries[0]).toHaveTextContent("25 min");
    expect(within(sessionLog()).getByText("1 session · 25 min")).toBeInTheDocument();
  });

  it("saves the session to storage", async () => {
    const { user, store } = await setup();

    await user.click(button("Start"));
    await passTime(25 * MIN);

    expect(JSON.parse(store.get(STORAGE_KEYS.sessions) ?? "null")).toMatchObject({
      version: 1,
      sessions: [{ durationMs: 25 * MIN }],
    });
  });

  it("doesn't log breaks or skipped focus sessions", async () => {
    const { user } = await setup();

    await user.click(button("Skip focus")); // skipped: not logged
    await user.click(button("Start"));
    await passTime(5 * MIN); // break completed: not logged

    expect(within(sessionLog()).getByText(/No focus sessions yet/)).toBeInTheDocument();
  });

  it("lists the newest session first", async () => {
    const { user } = await setup({ settings: { ...DEFAULT_SETTINGS, focusMin: 1, shortBreakMin: 1 } });

    for (let i = 0; i < 2; i++) {
      await user.click(button("Start"));
      await passTime(1 * MIN); // focus
      await user.click(button("Start"));
      await passTime(1 * MIN); // break
    }

    const entries = within(sessionLog()).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("09:02–09:03");
    expect(entries[1]).toHaveTextContent("09:00–09:01");
  });

  it("warns, but keeps showing the session, when storage refuses to save", async () => {
    const refusing: KeyValueStore = { ...createMemoryStore(), set: () => false };
    const { user } = await setup({ store: refusing });

    await user.click(button("Start"));
    await passTime(25 * MIN);

    expect(within(sessionLog()).getByRole("alert")).toHaveTextContent(/Couldn't save/);
    expect(within(sessionLog()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows only the latest 20 when there are more", async () => {
    const start = new Date(2026, 8, 1, 9, 0).getTime();
    const many = Array.from({ length: 23 }, (_, i) => {
      const endedAt = start + i * 60 * MIN + 25 * MIN;
      return { id: `focus-${endedAt}`, startedAt: endedAt - 25 * MIN, endedAt, durationMs: 25 * MIN };
    });
    const store = createMemoryStore({ [STORAGE_KEYS.sessions]: serializeSessions(many) });

    await setup({ store });

    expect(within(sessionLog()).getAllByRole("listitem")).toHaveLength(20);
    expect(within(sessionLog()).getByText("23 sessions · 575 min")).toBeInTheDocument();
    expect(within(sessionLog()).getByText("Showing the latest 20.")).toBeInTheDocument();
  });
});

describe("weekly stats", () => {
  it("count a focus session as soon as it finishes", async () => {
    const { user } = await setup();
    const stats = () => screen.getByRole("region", { name: "This week" });
    const focusTime = () => within(stats()).getByText("Focus time").nextElementSibling;

    expect(focusTime()).toHaveTextContent("0 min");

    await user.click(button("Start"));
    await passTime(25 * MIN);

    expect(focusTime()).toHaveTextContent("25 min");
    expect(within(stats()).getByText("Sessions").nextElementSibling).toHaveTextContent("1");
  });
});

describe("after a page refresh", () => {
  it("still shows earlier sessions", async () => {
    const store = createMemoryStore();
    const first = await setup({ store });
    await first.user.click(button("Start"));
    await passTime(25 * MIN);
    first.unmount();

    await setup({ store }); // same storage, fresh page

    expect(within(sessionLog()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("keeps saved timer lengths, and the settings form shows them", async () => {
    const store = createMemoryStore();
    const first = await setup({ store });
    await openSettings(first.user);
    await first.user.clear(screen.getByRole("spinbutton", { name: /^Focus/ }));
    await first.user.type(screen.getByRole("spinbutton", { name: /^Focus/ }), "50");
    await first.user.click(button("Save"));
    first.unmount();

    const second = await setup({ store });

    expect(display()).toHaveTextContent("50:00");
    await openSettings(second.user);
    expect(screen.getByRole("spinbutton", { name: /^Focus/ })).toHaveValue(50);
  });

  it("keeps sound switched off", async () => {
    const store = createMemoryStore();
    const first = await setup({ store });
    await openSettings(first.user);
    await first.user.click(screen.getByRole("checkbox", { name: "Sound and vibration" }));
    first.unmount();

    const second = await setup({ store });
    await openSettings(second.user);
    await second.user.click(button("Start"));
    await passTime(25 * MIN);

    expect(screen.getByRole("checkbox", { name: "Sound and vibration" })).not.toBeChecked();
    expect(second.alerts.chime).not.toHaveBeenCalled();
  });

  it("uses the starting settings when nothing was saved", async () => {
    await setup({ settings: { ...DEFAULT_SETTINGS, focusMin: 10 } });

    expect(display()).toHaveTextContent("10:00");
  });
});
