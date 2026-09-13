import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Alerts, PermissionResult } from "@/lib/alerts/browser";
import { DEFAULT_SETTINGS, type PomodoroSettings } from "@/lib/pomodoro/settings";
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

function setup({ settings = DEFAULT_SETTINGS, alerts = fakeAlerts() }: { settings?: PomodoroSettings; alerts?: ReturnType<typeof fakeAlerts> } = {}) {
  // user-event waits between keystrokes/clicks; tell it to use the fake clock to do so.
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const view = render(<Pomodoro initialSettings={settings} alerts={alerts} />);
  return { user, alerts, ...view };
}

/** Moving time makes React state change, so it has to happen inside act(). */
function passTime(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

const display = () => screen.getByRole("timer");
const phaseHeading = () => screen.getByRole("heading", { level: 2 });
const button = (name: string) => screen.getByRole("button", { name });
const queryButton = (name: string) => screen.queryByRole("button", { name });

/** Settings live in a <details> element; clicking its summary opens it. */
async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Settings"));
}

describe("before starting", () => {
  it("shows a 25-minute focus, session 1 of 4, ready to start", () => {
    setup();

    expect(phaseHeading()).toHaveTextContent("Focus");
    expect(display()).toHaveTextContent("25:00");
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Session 1 of 4")).toBeInTheDocument();
    expect(button("Start")).toBeEnabled();
    expect(button("Reset")).toBeDisabled();
    expect(button("Skip focus")).toBeEnabled();
    expect(queryButton("Pause")).not.toBeInTheDocument();
  });

  it("doesn't run any interval while idle", () => {
    setup();

    expect(jest.getTimerCount()).toBe(0);
  });

  it("puts the phase in the tab title", () => {
    setup();

    expect(document.title).toBe("Focus · Sipat");
  });
});

describe("running", () => {
  it("counts down once started, with the time in the tab title", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    passTime(90 * SEC);

    expect(display()).toHaveTextContent("23:30");
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(document.title).toBe("23:30 · Focus · Sipat");
  });

  it("switches sound on from the Start click (browsers require a click before audio)", async () => {
    const { user, alerts } = setup();

    await user.click(button("Start"));

    expect(alerts.unlockSound).toHaveBeenCalledTimes(1);
  });

  it("catches up straight away when a background tab becomes visible again", async () => {
    const { user } = setup();
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
    const { user } = setup();

    await user.click(button("Start"));
    passTime(5 * MIN);
    await user.click(button("Pause"));
    passTime(10 * MIN);

    expect(display()).toHaveTextContent("20:00");
    expect(document.title).toBe("Paused 20:00 · Focus · Sipat");
    expect(jest.getTimerCount()).toBe(0);

    await user.click(button("Resume"));
    passTime(1 * MIN);
    expect(display()).toHaveTextContent("19:00");
  });

  it("reset returns the current phase to its full length", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    passTime(7 * MIN);
    await user.click(button("Reset"));

    expect(display()).toHaveTextContent("25:00");
    expect(phaseHeading()).toHaveTextContent("Focus");
    expect(button("Reset")).toBeDisabled();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("when a focus session finishes", () => {
  it("moves to a short break that waits for you to start it", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    passTime(25 * MIN);

    expect(phaseHeading()).toHaveTextContent("Short break");
    expect(display()).toHaveTextContent("05:00");
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 sessions done")).toBeInTheDocument();
    expect(button("Skip break")).toBeInTheDocument();
    expect(document.title).toBe("Short break · Sipat");
    expect(jest.getTimerCount()).toBe(0);

    // Still 05:00 a minute later: breaks don't start on their own.
    passTime(1 * MIN);
    expect(display()).toHaveTextContent("05:00");
  });

  it("plays the chime and vibrates exactly once", async () => {
    const { user, alerts } = setup();

    await user.click(button("Start"));
    passTime(25 * MIN);
    passTime(5 * MIN); // more time passing must not replay it

    expect(alerts.chime).toHaveBeenCalledTimes(1);
    expect(alerts.vibrate).toHaveBeenCalledTimes(1);
  });

  it("stays silent when sound is switched off", async () => {
    const { user, alerts } = setup();

    await openSettings(user);
    await user.click(screen.getByRole("checkbox", { name: "Sound and vibration" }));
    await user.click(button("Start"));
    passTime(25 * MIN);

    expect(alerts.chime).not.toHaveBeenCalled();
    expect(alerts.vibrate).not.toHaveBeenCalled();
  });

  it("alerts even if the tab was hidden when time ran out", async () => {
    const { user, alerts } = setup();
    await user.click(button("Start"));

    jest.setSystemTime(Date.now() + 40 * MIN);
    act(() => {
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
    passTime(ms);
  }

  it("goes focus → short break → focus → long break → focus", async () => {
    const { user } = setup({ settings: quick });
    const seen: string[] = [phaseHeading().textContent ?? ""];

    for (const ms of [1 * MIN, 1 * MIN, 1 * MIN, 3 * MIN]) {
      await completeCurrentPhase(user, ms);
      seen.push(phaseHeading().textContent ?? "");
    }

    expect(seen).toEqual(["Focus", "Short break", "Focus", "Long break", "Focus"]);
  });

  it("shows the long break's own length and session numbers that start over", async () => {
    const { user } = setup({ settings: quick });

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
    const { user, alerts } = setup();

    await user.click(button("Start"));
    passTime(3 * MIN);
    await user.click(button("Skip focus"));

    expect(phaseHeading()).toHaveTextContent("Short break");
    expect(display()).toHaveTextContent("05:00");
    expect(screen.getByText("0 of 4 sessions done")).toBeInTheDocument();
    expect(alerts.chime).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("jumps from a break back to focus", async () => {
    const { user } = setup();

    await user.click(button("Skip focus"));
    await user.click(button("Skip break"));

    expect(phaseHeading()).toHaveTextContent("Focus");
  });
});

describe("settings", () => {
  const field = (name: RegExp) => screen.getByRole("spinbutton", { name });

  it("changes the length of a phase that hasn't started", async () => {
    const { user } = setup();

    await openSettings(user);
    await user.clear(field(/^Focus/));
    await user.type(field(/^Focus/), "50");
    await user.click(button("Save"));

    expect(display()).toHaveTextContent("50:00");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("shows a message and changes nothing when a value is invalid", async () => {
    const { user } = setup();

    await openSettings(user);
    await user.clear(field(/^Focus/));
    await user.type(field(/^Focus/), "0");
    await user.click(button("Save"));

    expect(field(/^Focus/)).toHaveAccessibleDescription("Must be between 1 and 180");
    expect(field(/^Focus/)).toHaveAttribute("aria-invalid", "true");
    expect(display()).toHaveTextContent("25:00");
  });

  it("keeps a running phase's length and uses the new one from the next phase", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    await openSettings(user);
    expect(screen.getByText(/Changes apply from the next phase/)).toBeInTheDocument();

    await user.clear(field(/^Short break/));
    await user.type(field(/^Short break/), "10");
    await user.click(button("Save"));
    passTime(1 * MIN);
    expect(display()).toHaveTextContent("24:00"); // unchanged: still the 25-minute focus

    passTime(24 * MIN);
    expect(display()).toHaveTextContent("10:00"); // the break uses the new length
  });

  it("changes how many dots the cycle has", async () => {
    const { user } = setup();

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
    const { user, alerts } = setup();

    await user.click(button("Start"));
    passTime(25 * MIN);

    expect(alerts.notify).not.toHaveBeenCalled();
  });

  it("ask for permission, then announce the next phase", async () => {
    const { user, alerts } = setup();

    await openSettings(user);
    await toggleNotifications(user);
    expect(alerts.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(notifyBox()).toBeChecked();

    await user.click(button("Start"));
    passTime(25 * MIN);

    expect(alerts.notify).toHaveBeenCalledWith("Focus session done", "Time for a 5-minute break.");
  });

  it("stay off and explain why when permission is blocked", async () => {
    const { user, alerts } = setup({ alerts: fakeAlerts({ permission: "denied" }) });

    await openSettings(user);
    await toggleNotifications(user);

    expect(notifyBox()).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent(/blocked for this site/);

    await user.click(button("Start"));
    passTime(25 * MIN);
    expect(alerts.notify).not.toHaveBeenCalled();
  });

  it("explain the fallback when the browser refuses to show them (Android Chrome)", async () => {
    const { user, alerts } = setup({ alerts: fakeAlerts({ notifyWorks: false }) });

    await openSettings(user);
    await toggleNotifications(user);
    await user.click(button("Start"));
    passTime(25 * MIN);

    expect(alerts.notify).toHaveBeenCalledTimes(1);
    expect(alerts.chime).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(/sound and vibration instead/);
  });
});

describe("keyboard", () => {
  it("can be started and paused with the keyboard alone", async () => {
    const { user } = setup();

    await user.tab(); // focus lands on Start
    await user.keyboard("{Enter}");
    passTime(2 * SEC);
    // Start turned into Pause in the same spot, so focus is still on it.
    await user.keyboard(" ");

    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(display()).toHaveTextContent("24:58");
  });
});

describe("unmounting", () => {
  it("clears its interval and restores the previous tab title", async () => {
    const { user, unmount } = setup();

    await user.click(button("Start"));
    passTime(1 * SEC);
    unmount();

    expect(jest.getTimerCount()).toBe(0);
    expect(document.title).toBe("Sipat");
  });
});

describe("tab title vs. the framework", () => {
  /**
   * Found in a real browser, not by Jest: Next.js finished hydrating its own <title> after our
   * first write and replaced it. This reproduces that by overwriting the title after mount.
   */
  it("puts its title back when something else overwrites it", async () => {
    setup();
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
    const { unmount } = setup();
    unmount();

    act(() => {
      document.title = "Another page";
    });
    await act(async () => {});

    expect(document.title).toBe("Another page");
  });
});

describe("progress dots", () => {
  it("are hidden from screen readers, which get the text version instead", () => {
    const { container } = setup();

    const dots = container.querySelector("ol");
    expect(dots).toHaveAttribute("aria-hidden", "true");
    expect(within(dots as HTMLElement).queryAllByRole("listitem")).toHaveLength(0);
  });
});
