# Block 2: Timer UI

**Status:** ✅ done · 53 tests passing (25 new in this block) · the live site now has a working 25-minute timer

## What we built

| File | What it is |
|---|---|
| [`src/lib/timer/format.ts`](../../src/lib/timer/format.ts) | `formatRemaining(ms)` → `"mm:ss"` |
| [`src/hooks/useTimer.ts`](../../src/hooks/useTimer.ts) | Connects the Block 1 engine to React: `useReducer` plus a refresh interval |
| [`src/hooks/useDocumentTitle.ts`](../../src/hooks/useDocumentTitle.ts) | Writes the tab title, and restores the old one on unmount |
| [`src/components/Timer.tsx`](../../src/components/Timer.tsx) | The UI: status label, big display, Start/Pause/Resume and Reset |
| [`src/components/Timer.test.tsx`](../../src/components/Timer.test.tsx) | 15 tests that click, press keys and move the fake clock |
| [`src/lib/timer/format.test.ts`](../../src/lib/timer/format.test.ts) | 9 tests for formatting and rounding |
| [`src/app/page.test.tsx`](../../src/app/page.test.tsx) | +1 test: the home page shows a timer ready to start |

The layers, and which one depends on which:

```
 Timer.tsx          what the user sees and clicks
   │  uses
   ├── useTimer          when to look at the clock   (React + setInterval)
   │     └── timer.ts        what the time is        (pure, Block 1)
   ├── useDocumentTitle  the tab title side effect
   └── format.ts         ms → "mm:ss"                (pure)
```

The pure layers at the bottom don't know React exists. The top layer doesn't know how time is
calculated.

## Six ideas to take away

### 1. The engine decides *what*; the hook decides *when*
`useTimer` doesn't calculate time. It asks the engine every 250 ms while running, and straight
away when a hidden tab becomes visible (`visibilitychange`). A late or skipped refresh only
makes the display less fresh. It never makes it wrong.

### 2. Effects must clean up after themselves
The `useEffect` that starts the interval returns a function that stops it. React runs that on
pause, finish and unmount. The tests check this with `jest.getTimerCount()`: **0** intervals
while idle, paused, finished or unmounted, and exactly **1** while running. A missing
`clearInterval` would leak a new interval on every start, and 4 tests catch that.

### 3. Round the display *up*
`Math.ceil` makes a timer read `25:00` the instant it starts and reach `00:00` only when time is
truly up. With `Math.floor` it would jump to `24:59` immediately and sit on `00:00` for a whole
second. Small detail, but it's what makes a timer feel right.

### 4. Test through what the user sees
Tests find things by **role and name**: `getByRole("timer")`, `getByRole("button", { name: "Pause" })`.
Never by CSS class. That's also how screen readers find them, so a test that passes means the
page is also understandable without seeing it.

### 5. `act()` and fake timers
Moving the fake clock makes React state change, so it goes inside `act(() => …)`. That tells
React to finish updating before the test looks at the screen. `user-event` is set up with
`advanceTimers: jest.advanceTimersByTime` so its own tiny delays between clicks use the fake
clock too.

### 6. One button that changes label keeps keyboard focus
Start → Pause → Resume is **one** `<button>` whose label changes, not three buttons swapped in
and out. React keeps the same element in the page, so keyboard focus stays on it and you can
press Space again to pause. A test covers this.

## Decisions made in this block

| Decision | Why |
|---|---|
| Refresh every 250 ms, not 1000 ms | A 1 s interval can be up to a second late, so the display would visibly lag the real time |
| No interval while idle or paused | An idle timer costs zero CPU or battery |
| `role="timer"` on the display | Assistive tech knows it's a clock, but doesn't read out every second |
| Tab titles: `24:59 · Sipat`, `Paused 24:59 · Sipat`, `Time's up · Sipat`, `Sipat` | Glanceable from another tab. The time comes first so it survives when many tabs shrink the title |
| Tab title is its own hook | [Keep components swappable](../PLAN.md): the side effect lives apart from the UI |
| Body font now uses Geist | The template's CSS set Arial, which overrode the Geist font it loaded |

## How we know the tests work

Four realistic bugs were planted one at a time:

| Planted bug | Tests that failed |
|---|---|
| Interval never cleared (leak) | 4 |
| No refresh when a background tab becomes visible | 1 |
| Display rounds down instead of up | 2 |
| Reset button never disabled | 2 |

Every bug was caught, and the files were restored (checked by hash).

## Checked in a real browser (things Jest can't prove)

| Check | Result |
|---|---|
| Page loads with no hydration errors or console errors | ✅ |
| Click Start → counts down, tab title updates live (`24:57 · Sipat`) | ✅ |
| Pause → display frozen for 4 real seconds, title `Paused 24:08 · Sipat` | ✅ |
| Resume → continues from 24:08 | ✅ |
| Reset → `25:00`, `Ready`, title `Sipat`, Reset disabled | ✅ |
| The Start/Pause/Resume button stays the same element | ✅ (same element ID before and after) |
| Phone width (375 px): no sideways scroll, 48 px tap targets | ✅ |
| Keyboard Space/Enter in the real browser | ⚠️ Not provable with the preview tool: its synthetic key events reach the button but never trigger the browser's built-in click, not even for Enter. Covered by the Jest keyboard test instead, and the buttons are standard `<button>` elements |
| A background tab catching up after minutes hidden | ⚠️ Can't be simulated in the preview pane. Covered by a Jest test using `visibilitychange` |
| The timer reaching 00:00 | ⚠️ Not waited 25 real minutes. Covered by Jest with a 3-second timer |

## Deliberately NOT in this block

| Not yet | Comes in |
|---|---|
| Breaks, cycles of 4, editable lengths | Block 3 |
| Sound or notification when time is up | Block 3 |
| Saving finished sessions | Block 4 |
| Keyboard shortcuts (e.g. Space anywhere to start/pause) | Block 6 |
| Refresh the page mid-session and keep the timer | Not planned yet: a refresh currently resets the timer |
