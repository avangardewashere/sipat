import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timer } from "./Timer";

const SEC = 1_000;
const MIN = 60 * SEC;

/**
 * Fake timers replace setInterval AND Date.now(), so the real hook runs unchanged
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

function setup(durationMs = 25 * MIN) {
  // user-event waits between keystrokes/clicks; tell it to use the fake clock to do so.
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const view = render(<Timer durationMs={durationMs} />);
  return { user, ...view };
}

/** Moving time makes React state change, so it has to happen inside act(). */
function passTime(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

const display = () => screen.getByRole("timer");
const button = (name: string) => screen.getByRole("button", { name });
const queryButton = (name: string) => screen.queryByRole("button", { name });

describe("before starting", () => {
  it("shows the full duration, a Start button and a disabled Reset", () => {
    setup();

    expect(display()).toHaveTextContent("25:00");
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(button("Start")).toBeEnabled();
    expect(button("Reset")).toBeDisabled();
    expect(queryButton("Pause")).not.toBeInTheDocument();
  });

  it("doesn't run any interval while idle", () => {
    setup();

    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps the plain app name as the tab title", () => {
    setup();

    expect(document.title).toBe("Sipat");
  });
});

describe("running", () => {
  it("counts down once started", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    passTime(1 * SEC);

    expect(display()).toHaveTextContent("24:59");
    expect(screen.getByText("Focusing")).toBeInTheDocument();

    passTime(4 * MIN);
    expect(display()).toHaveTextContent("20:59");
  });

  it("swaps Start for Pause and enables Reset", async () => {
    const { user } = setup();

    await user.click(button("Start"));

    expect(button("Pause")).toBeInTheDocument();
    expect(queryButton("Start")).not.toBeInTheDocument();
    expect(button("Reset")).toBeEnabled();
  });

  it("shows the time left in the tab title", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    passTime(90 * SEC);

    expect(document.title).toBe("23:30 · Sipat");
  });

  it("catches up straight away when a background tab becomes visible again", async () => {
    const { user } = setup();
    await user.click(button("Start"));

    // Hidden tab: 10 minutes pass and the interval never gets to run.
    jest.setSystemTime(Date.now() + 10 * MIN);
    // The tab is shown again. No interval tick yet, just the visibility event.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(display()).toHaveTextContent("15:00");
  });
});

describe("pause and resume", () => {
  it("freezes the display while paused", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    passTime(5 * MIN);
    await user.click(button("Pause"));
    passTime(10 * MIN);

    expect(display()).toHaveTextContent("20:00");
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(document.title).toBe("Paused 20:00 · Sipat");
  });

  it("stops the interval while paused", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    expect(jest.getTimerCount()).toBe(1);

    await user.click(button("Pause"));
    expect(jest.getTimerCount()).toBe(0);
  });

  it("continues from where it paused", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    passTime(5 * MIN);
    await user.click(button("Pause"));
    passTime(10 * MIN);
    await user.click(button("Resume"));
    passTime(1 * MIN);

    expect(display()).toHaveTextContent("19:00");
  });
});

describe("reset", () => {
  it("returns to the full duration and the idle state", async () => {
    const { user } = setup();

    await user.click(button("Start"));
    passTime(7 * MIN);
    await user.click(button("Reset"));

    expect(display()).toHaveTextContent("25:00");
    expect(button("Start")).toBeEnabled();
    expect(button("Reset")).toBeDisabled();
    expect(document.title).toBe("Sipat");
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("finishing", () => {
  it("stops at 00:00 and tells you time is up", async () => {
    const { user } = setup(3 * SEC);

    await user.click(button("Start"));
    passTime(5 * SEC);

    expect(display()).toHaveTextContent("00:00");
    expect(screen.getByText("Time's up")).toBeInTheDocument();
    expect(document.title).toBe("Time's up · Sipat");
    expect(button("Start")).toBeDisabled();
    expect(button("Reset")).toBeEnabled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("can be reset and started again", async () => {
    const { user } = setup(3 * SEC);

    await user.click(button("Start"));
    passTime(5 * SEC);
    await user.click(button("Reset"));
    await user.click(button("Start"));
    passTime(1 * SEC);

    expect(display()).toHaveTextContent("00:02");
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
