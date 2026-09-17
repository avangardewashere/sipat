/**
 * Automated accessibility checks with axe-core, the engine behind most browser a11y audits.
 *
 * What this catches: missing labels, broken ARIA, buttons without names, invalid list or table
 * structure, headings out of order, and similar. What it can't: colour contrast (jsdom doesn't
 * lay out or paint, so axe skips that rule here), and whether the page actually makes sense to a
 * screen-reader user. It's a safety net, not a substitute for trying the page.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Pomodoro } from "@/components/Pomodoro";
import type { Alerts } from "@/lib/alerts/browser";
import { serializeSessions } from "@/lib/sessions/session";
import { createMemoryStore } from "@/lib/storage/keyValueStore";
import { createLocalRepository, STORAGE_KEYS } from "@/lib/storage/repository";
import Home from "./page";

const MIN = 60_000;

// axe runs dozens of rules over the whole page, and its first run in a file also loads the engine.
// That's slower than Jest's default 5-second limit per test, but not a sign of a problem.
jest.setTimeout(30_000);

const silentAlerts: Alerts = {
  unlockSound: () => {},
  chime: () => {},
  vibrate: () => {},
  notify: () => true,
  requestNotificationPermission: async () => "granted",
};

/** A repository with a few sessions from this week, so the log and chart have content. */
function repositoryWithSessions() {
  const now = Date.now();
  const sessions = [3, 2, 1].map((hoursAgo) => {
    const endedAt = now - hoursAgo * 60 * MIN;
    return { id: `focus-${endedAt}`, startedAt: endedAt - 25 * MIN, endedAt, durationMs: 25 * MIN };
  });
  return createLocalRepository(createMemoryStore({ [STORAGE_KEYS.sessions]: serializeSessions(sessions) }));
}

async function waitForLoad() {
  await waitFor(() => expect(screen.queryByText("Loading your sessions…")).not.toBeInTheDocument());
}

afterEach(() => window.localStorage.clear());

it("the first visit has no detectable accessibility problems", async () => {
  const { container } = render(<Home />);
  await waitForLoad();

  expect(await axe(container)).toHaveNoViolations();
});

it("a page with history, open settings and a chart tooltip has none either", async () => {
  const user = userEvent.setup();
  const { container } = render(<Pomodoro alerts={silentAlerts} repository={repositoryWithSessions()} />);
  await waitForLoad();

  await user.click(screen.getByText("Settings"));
  await user.hover(within(screen.getByRole("list", { name: /Focus per day/ })).getAllByRole("listitem")[0]);

  expect(await axe(container)).toHaveNoViolations();
});

it("the table view, a deleted-session notice and the clear-history confirmation have none either", async () => {
  const user = userEvent.setup();
  const { container } = render(<Pomodoro alerts={silentAlerts} repository={repositoryWithSessions()} />);
  await waitForLoad();

  await user.click(screen.getByRole("button", { name: "Show as table" }));
  await user.click(screen.getAllByRole("button", { name: /Delete session/ })[0]);
  await user.click(screen.getByRole("button", { name: "Clear history" }));

  expect(await axe(container)).toHaveNoViolations();
});
