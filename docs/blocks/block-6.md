# Block 6: Polish and v0 release

**Status:** ✅ done · 225 tests passing (33 new, including 3 accessibility checks) + 5 daylight-saving tests · tagged **v0.1.0**

## What we built

| File | What it is |
|---|---|
| [`src/lib/storage/repository.ts`](../../src/lib/storage/repository.ts) | `deleteSession` and `clearSessions`, following the same read-fresh-before-write rule |
| [`src/components/SessionLog.tsx`](../../src/components/SessionLog.tsx) | A delete button per session with **Undo**, and **Clear history** behind a confirm step |
| [`src/lib/shortcuts/shortcuts.ts`](../../src/lib/shortcuts/shortcuts.ts) | Which key does what, as a pure function |
| [`src/hooks/useKeyboardShortcuts.ts`](../../src/hooks/useKeyboardShortcuts.ts) | Listens on the page; stops Space from scrolling |
| [`src/app/accessibility.test.tsx`](../../src/app/accessibility.test.tsx) | axe-core checks on the main page states |
| [`src/app/icon.svg`](../../src/app/icon.svg) | The Sipat icon (replaces Next.js's default favicon) |
| [`README.md`](../../README.md) | What Sipat is, how to run it, how it's built and tested |

Tests: `repository.test.ts` (+6), `shortcuts.test.ts` (15), `Pomodoro.test.tsx` (+9), `accessibility.test.tsx` (3).

## Five ideas to take away

### 1. Undo for small mistakes, confirm for big ones
Deleting one session is a quick click that's easy to do by accident, so it happens immediately
and offers **Undo**. Asking "are you sure?" for every small action trains people to click Yes
without reading. Clearing *all* history can't be undone, so that one asks first and names what
will be lost ("Delete all 12 sessions? This can't be undone.").

Undo works because of Block 4's ids: putting the session back with the same id restores exactly
what was removed.

### 2. Shortcuts must not fight the page's own keys
Space already clicks a focused button. If the page-wide shortcut *also* reacted, pressing Space on
the Pause button would pause and then immediately resume. Shortcuts therefore ignore keys pressed
in fields, buttons, links and `<summary>`, and leave <kbd>Ctrl</kbd>/<kbd>⌘</kbd>/<kbd>Alt</kbd>
combinations to the browser (so <kbd>Ctrl</kbd>+<kbd>R</kbd> still reloads). Both have tests,
and planting either bug makes them fail.

### 3. Accessibility can be partly automated
`jest-axe` runs axe-core, the engine behind most browser accessibility audits, against the
rendered page on every test run: the first visit, a page with history and open settings, and the
table view with the delete and clear notices showing. It catches broken ARIA, unnamed buttons and
invalid structure. It *can't* check colour contrast in jsdom (nothing is painted there) or whether
the page makes sense to a person using a screen reader. It's a safety net, not a verdict.

### 4. A flaky test is a real problem
During the planted-bug run, one bug made **3** test files fail when only 2 should have. Re-running
it alone gave exactly 2. The third was a long test passing Jest's 5-second limit while six full
runs competed for the CPU. A test that fails at random teaches everyone to ignore red CI, so the
limit is now 20 seconds, with the reason written next to it in `jest.config.ts`.

### 5. "Shipped" is more than "it runs"
It also means someone else can understand it. The README says what Sipat does, how to run it, how
the code is laid out, how it's tested, and what it doesn't do yet. The notes for all seven blocks
record the decisions and why they were made.

## How we know the tests work

| Planted bug | Tests that failed |
|---|---|
| Shortcuts also fire on a focused button (Space pauses and resumes) | 1 |
| Ctrl/⌘/Alt combinations not ignored (Ctrl+R resets the timer) | 2 |
| `deleteSession` wipes every session | 5 |
| Undo shows the session again but doesn't save it | 1 |
| Clear history skips the confirmation | 2 |
| A chart column labelled by an element that doesn't exist (caught by **axe**) | 1 |

Every file was restored and checked by hash. See idea 4 for the one flaky result in this run and
how it was confirmed.

## Checked in a real browser (things Jest can't prove)

| Check | Result |
|---|---|
| Page loads with the new icon linked; no console errors | ✅ |
| Shortcut hint visible on a device with a mouse | ✅ |
| **S** skips focus → short break → focus, with titles updating | ✅ |
| **R** resets | ✅ (no visible change from Ready, as expected) |
| **Space** starts/pauses | ⚠️ Not provable with the preview tool: its "space" sends `key: ""` with no `code`, where a real keyboard sends `key: " "`. R and S prove the listener works; Space is covered by 2 Jest tests. **Worth one press on your keyboard.** |
| Delete a session → gone from the list, storage and weekly total; "Session deleted. Undo" shows | ✅ |
| Undo → both sessions back in storage, still there after a refresh | ✅ |
| Clear history → confirm step names the count → Delete all → empty log, storage `{"version":1,"sessions":[]}`, weekly total 0 min | ✅ |
| Icon renders: blue sight ring, ticks, centre dot on a dark square | ✅ |

## v0 at a glance

| | |
|---|---|
| Live | https://sipat-jade.vercel.app |
| Tests | 225 in UTC+8 + 5 in New York time, all in CI |
| Blocks | 7 (0–6), each tested, deployed and written up |
| Planted bugs caught across all blocks | 37 (3 + 4 + 7 + 8 + 9 + 6) |

## Known limitations carried into v0

| Limitation | Possible next step |
|---|---|
| Refreshing resets a timer that's running | Save timer state on start/pause |
| Data lives in one browser, no sync | The repository interface is ready for a database (v2 idea) |
| Android Chrome: no system notifications | A service worker / installable app |
| Chime can be up to ~1 min late in a background tab | Schedule the chime with Web Audio's own clock |
| Another open tab doesn't update live | Listen for the browser's `storage` event |
| Weeks always start on Monday | A setting |
| No streaks, goals or data export | Only if wanted |
