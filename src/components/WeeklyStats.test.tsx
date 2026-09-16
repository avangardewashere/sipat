import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FocusSession } from "@/lib/sessions/session";
import { WeeklyStats } from "./WeeklyStats";

const MIN = 60_000;

/** Local time (UTC+8, see jest.config.ts). Month is 1-based. */
function at(month: number, day: number, hour = 0, minute = 0): number {
  return new Date(2026, month - 1, day, hour, minute).getTime();
}

function session(startedAt: number, minutes: number): FocusSession {
  const endedAt = startedAt + minutes * MIN;
  return { id: `focus-${endedAt}`, startedAt, endedAt, durationMs: minutes * MIN };
}

// "Now" is Wednesday 16 September 2026, 18:00.
const WEDNESDAY_EVENING = at(9, 16, 18);

const thisWeek = [
  session(at(9, 14, 9), 25), // Mon
  session(at(9, 14, 10), 25), // Mon
  session(at(9, 16, 9), 25), // Wed
];
const lastWeek = [session(at(9, 9, 20), 50)]; // Wed 9 Sep

function renderStats(sessions: FocusSession[], now = WEDNESDAY_EVENING) {
  const user = userEvent.setup();
  render(<WeeklyStats sessions={sessions} clock={() => now} locale="en-US" />);
  return { user };
}

const stat = (label: string) => screen.getByText(label).nextElementSibling;
const dayColumns = () => within(screen.getByRole("list", { name: /Focus per day/ })).getAllByRole("listitem");

describe("headline numbers", () => {
  it("names the week and its dates", () => {
    renderStats(thisWeek);

    expect(screen.getByRole("heading", { name: "This week" })).toBeInTheDocument();
    expect(screen.getByText("Sep 14 – Sep 20")).toBeInTheDocument();
  });

  it("shows total focus, session count and best day", () => {
    renderStats(thisWeek);

    expect(stat("Focus time")).toHaveTextContent("1 h 15 min");
    expect(stat("Sessions")).toHaveTextContent("3");
    expect(stat("Best day")).toHaveTextContent("Mon");
  });

  it("says so when the week is empty", () => {
    renderStats([]);

    expect(screen.getByText("No focus sessions this week yet.")).toBeInTheDocument();
    expect(stat("Focus time")).toHaveTextContent("0 min");
    expect(stat("Best day")).toHaveTextContent("–");
  });
});

describe("chart", () => {
  it("has one column per day, Monday to Sunday, each described for screen readers", () => {
    renderStats(thisWeek);

    const columns = dayColumns();
    expect(columns).toHaveLength(7);
    expect(columns[0]).toHaveAccessibleName("Mon, Sep 14: 50 min, 2 sessions");
    expect(columns[1]).toHaveAccessibleName("Tue, Sep 15: 0 min, 0 sessions");
    expect(columns[2]).toHaveAccessibleName("Wed, Sep 16: 25 min, 1 session");
  });

  it("draws bars only for days with focus, scaled to a clean axis", () => {
    renderStats(thisWeek);

    // Tallest day is 50 min, so the axis runs 0–60 min: 50 min is 83.3% tall, 25 min is 41.7%.
    const bars = screen.getAllByTestId("bar");
    expect(bars).toHaveLength(2);
    expect(parseFloat(bars[0].style.height)).toBeCloseTo(83.33, 1);
    expect(parseFloat(bars[1].style.height)).toBeCloseTo(41.67, 1);
  });

  it("labels only the peak value", () => {
    renderStats(thisWeek);

    // "50 min" appears once on the chart: the label on Monday's bar.
    const chart = screen.getByRole("figure");
    expect(within(chart).getAllByText("50 min")).toHaveLength(1);
    expect(within(chart).queryByText("25 min")).not.toBeInTheDocument();
  });

  it("shows a tooltip with the value when a day is hovered", async () => {
    const { user } = renderStats(thisWeek);

    await user.hover(dayColumns()[2]);

    expect(screen.getByRole("tooltip")).toHaveTextContent("25 min");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Wed, Sep 16 · 1 session");

    await user.unhover(dayColumns()[2]);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the same tooltip on keyboard focus", async () => {
    const { user } = renderStats(thisWeek);

    // Focusing changes React state, so it happens inside act().
    act(() => dayColumns()[0].focus());

    expect(screen.getByRole("tooltip")).toHaveTextContent("50 min");
    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("0 min"); // moved on to Tuesday
  });
});

describe("table view", () => {
  it("lists every day's value, so nothing depends on seeing the chart", async () => {
    const { user } = renderStats(thisWeek);

    await user.click(screen.getByRole("button", { name: "Show as table" }));
    const rows = within(screen.getByRole("table")).getAllByRole("row");

    expect(rows[1]).toHaveTextContent("Mon, Sep 1450 min2");
    expect(rows[3]).toHaveTextContent("Wed, Sep 16 (today)25 min1");
    expect(rows[8]).toHaveTextContent("Total1 h 15 min3");
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show as chart" }));
    expect(screen.getByRole("figure")).toBeInTheDocument();
  });
});

describe("week navigation", () => {
  it("can't go past this week", () => {
    renderStats(thisWeek);

    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
  });

  it("goes back to last week and returns", async () => {
    const { user } = renderStats([...lastWeek, ...thisWeek]);

    await user.click(screen.getByRole("button", { name: "Previous week" }));

    expect(screen.getByRole("heading", { name: "Last week" })).toBeInTheDocument();
    expect(screen.getByText("Sep 7 – Sep 13")).toBeInTheDocument();
    expect(stat("Focus time")).toHaveTextContent("50 min");
    expect(stat("Best day")).toHaveTextContent("Wed");

    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByRole("heading", { name: "Week of Aug 31" })).toBeInTheDocument();
    expect(screen.getByText("No focus sessions that week.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next week" }));
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("heading", { name: "This week" })).toBeInTheDocument();
  });
});

describe("staying correct past midnight", () => {
  it("moves 'today' forward when a session finishes after midnight, even into a new week", () => {
    // Opened on Sunday evening; a session then finishes at 00:20 on Monday.
    const sundayNight = at(9, 20, 23);
    const afterMidnight = session(at(9, 20, 23, 55), 25);

    renderStats([afterMidnight], sundayNight);

    expect(screen.getByText("Sep 21 – Sep 27")).toBeInTheDocument(); // the new week
    expect(stat("Focus time")).toHaveTextContent("20 min"); // 00:00–00:20 of it
  });
});
