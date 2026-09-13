# Block 1: Timer engine

**Status:** ✅ done · 28 tests passing · no visible change on the live site (this block has no UI)

## What we built

| File | What it is |
|---|---|
| [`src/lib/timer/timer.ts`](../../src/lib/timer/timer.ts) | The engine: a `TimerState` type, a `timerReducer`, and `getElapsedMs` / `getRemainingMs` |
| [`src/lib/timer/timer.test.ts`](../../src/lib/timer/timer.test.ts) | 25 tests covering every state and action |
| [`src/lib/timer/drift.test.ts`](../../src/lib/timer/drift.test.ts) | 3 fake-timer tests comparing a naive countdown with the engine |

A timer is always in one of four states:

```
            start              time runs out (tick)
   idle ───────────► running ─────────────────────► finished
    ▲                 │   ▲                            │
    │           pause │   │ start (resume)             │
    │                 ▼   │                            │
    │                paused                            │
    └──────────── reset (from any state) ──────────────┘
```

## Five ideas to take away

### 1. Store *when*, not *how much is left*
A running timer stores `startedAt`. It never stores "seconds left". Remaining time is worked out
from the clock whenever it's asked for: `duration − (earlier runs + (now − startedAt))`. So a late
tick can't make it wrong.

### 2. Pass the time in; don't read the clock
No function calls `Date.now()`. Every action carries `now`. That's why a test can say "it is now
2 hours later" in one line and run in milliseconds.

### 3. Each state only holds the fields that make sense for it
`TimerState` is a **discriminated union**: `finishedAt` only exists when `status` is `"finished"`.
TypeScript won't let you read `startedAt` on a paused timer. Whole categories of bugs can't
compile.

### 4. Ignored actions return the *same object*
Starting a timer that's already running returns the exact same state object (`toBe`, not
`toEqual`). React's `useReducer` sees that and skips a re-render. Tests use it to prove "this
action was ignored".

### 5. Two ways to move time in Jest
| Call | What it simulates |
|---|---|
| `jest.advanceTimersByTime(ms)` | A focused tab: the clock moves and timers fire |
| `jest.setSystemTime(ms)` | A throttled tab or a sleeping laptop: the clock moves, nothing fires |

In a simulated 10 minutes of throttled background tab, the naive counter believed only
**10 seconds** had passed. The engine was exact.

## Decisions made in this block

| Decision | Why |
|---|---|
| A finished timer ignores `start`. You must `reset` first. | Stops an accidental double-tap from quietly starting a new session |
| `finishedAt` is the *real* end time, not the time of the tick that noticed it | Block 4 logs sessions. A laptop that slept shouldn't log a session ending 2 hours late |
| `pause` after the deadline gives `finished`, not `paused` | You can't pause a timer whose time is already up |
| A clock moved backwards never adds time | `Math.max(0, …)` guard; covered by a test |
| Engine tests run in `node`, not `jsdom` | No DOM needed, so they run faster |

## How we know the tests work

Passing tests only prove something if they **fail when the code is wrong**. Three realistic bugs
were planted one at a time:

| Planted bug | Tests that failed |
|---|---|
| `finishedAt` set to the tick's time instead of the real end | 4 |
| Removed the guard against the clock moving backwards | 1 |
| Resuming forgets the time already done before the pause | 3 |

Every bug was caught, and the original code was restored after each one.

## Deliberately NOT in this block

| Not yet | Comes in |
|---|---|
| Any UI, `mm:ss` formatting, the tab title | Block 2 |
| A real `setInterval` driving the engine inside React | Block 2 |
| Focus/break cycles, editable lengths, sounds | Block 3 |
| Saving sessions | Block 4 |
