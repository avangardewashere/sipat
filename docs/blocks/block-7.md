# Block 7: Resume after refresh

**Status:** ✅ done · 263 tests passing (38 new) + 5 daylight-saving tests · first block of [v0.5](../PLAN-v0.5.md)

A refresh, a closed tab or a browser restart no longer loses a running timer.

## What we built

| File | What it is |
|---|---|
| [`src/lib/pomodoro/savedCycle.ts`](../../src/lib/pomodoro/savedCycle.ts) | What gets saved (phase, cycle position, timer, start time), and strict reading back |
| [`src/lib/pomodoro/pomodoro.ts`](../../src/lib/pomodoro/pomodoro.ts) | A new `restore` action, and a `whileAway` flag on completions |
| [`src/lib/storage/repository.ts`](../../src/lib/storage/repository.ts) | `loadCycle` / `saveCycle` under the key `sipat:v1:cycle` |
| [`src/hooks/useSaveCycle.ts`](../../src/hooks/useSaveCycle.ts) | Saves the cycle whenever it changes, but only after loading |
| [`src/hooks/useStoredData.ts`](../../src/hooks/useStoredData.ts) | Now also loads the saved cycle |
| [`src/components/Pomodoro.tsx`](../../src/components/Pomodoro.tsx) | Restores on load; shows the "while Sipat was closed" notice |

Tests: `savedCycle.test.ts` (16), `pomodoro.test.ts` (+8), `repository.test.ts` (+4), `Pomodoro.test.tsx` (+10).

## What happens on reopening

| The timer was… | You see |
|---|---|
| Running, time still left | It keeps running, having counted the time the page was closed |
| Running, and time ran out while closed | The next phase, ready to start. A focus session is **logged with its real times**, and a notice says "Your focus session finished at 10:25 while Sipat was closed. It's in your log." No chime |
| Paused | Paused, exactly where it was, however long ago |
| Idle, or a skipped phase | The same phase, with its length from your current settings |

## Five ideas to take away

### 1. Block 1's design made this block small
The timer was never saved as "18 minutes left". It stores *when it started*. So restoring a timer
started at 09:00 at 09:07 needs no catching-up logic: the engine just reports 18 minutes left. And if
the page reopens at 11:00, one `tick` at "now" lets the engine decide it finished at 09:25, the
real end time. The whole restore is a few lines, because the hard part was decided six blocks ago.

### 2. Save when something changes, not on a schedule
The cycle is saved whenever the phase, cycle position, timer or start time changes. That sounds
expensive for a timer, but ticks that change nothing return the *same* timer object (also Block 1),
so a running timer is saved on start, pause, reset, skip and finish, not four times a second.

### 3. The dangerous moment is the first render
On page load the component starts with a fresh, idle timer, and saved data arrives a moment
later. If saving were on from the start, the very first save would **write that fresh timer over
the one you had running**, destroying it just before it could be restored. So saving stays off until
loading has finished.

This is exactly the kind of bug that works fine most of the time: whether it strikes depends on which
effect happens to run first. So its test doesn't rely on luck. It uses a repository whose loading
is **held back on purpose**, lets every mount effect run, and checks the saved timer is untouched.
Planting the bug made that test fail.

### 4. What happened while you were away needs different treatment
A chime when you reopen the page for a session that ended half an hour ago would be late and
confusing. The reducer marks such a completion `whileAway`; the component skips the chime and the
notification, still logs the session, and says in plain words what happened.

### 5. Not all saved data deserves the same care
Unreadable *sessions* are backed up before they can be overwritten (Block 4): they're your history.
Unreadable *timer state* is simply ignored and the timer starts fresh: the worst case is one
unfinished session. Validation is still strict, though: a "running" timer without a start time is
rejected as a whole, rather than showing a nonsense countdown.

## Decisions made in this block

| Decision | Why |
|---|---|
| No chime or notification for a phase that ended while closed | It would be late; a notice explains instead |
| The notice disappears on Dismiss or when you start the next phase | It's about the past; starting something new means you've seen it |
| An idle phase takes the current settings' length on restore | Same rule as always: only a started phase keeps its original length |
| Unreadable timer state isn't backed up | Low stakes, unlike session history |
| Completions aren't saved | They're signals for effects, not data. Saving one would replay its notice on every refresh (a test checks this doesn't happen) |

## How we know the tests work

| Planted bug | Tests that failed |
|---|---|
| Saving starts before loading finishes (overwrites the running timer) | 1 (the held-back loading test) |
| Restore doesn't catch up on the time passed while closed | 7 |
| A completion while away isn't marked (so it would chime) | 5 |
| An idle phase restored with its old saved length | 1 |
| A running timer with no start time is accepted | 1 |
| The cycle is never saved | 8 |

Every file was restored and checked by hash.

**One planted bug I decided *not* to run:** "restore before applying settings". My own code comment
claimed the order mattered, but on inspection it doesn't: `updateSettings` already gives an idle
phase the new length and leaves a running one alone. That bug would have passed every test *because
there's nothing to catch*. The fix was to correct the comment, not to write a test for a rule
that doesn't exist.

## Checked in a real browser (things Jest can't prove)

| Check | Result |
|---|---|
| Start, wait, refresh → still running, and the reload time was counted (`24:55` → `24:51` five seconds later) | ✅ |
| Pause, refresh → paused at exactly `24:25`, Resume button shown | ✅ |
| Saved start time moved 40 min into the past, refresh → Short break, session logged `00:38–01:03`, notice "finished at 01:03", stored in `sipat:v1:sessions` | ✅ |
| Weekly stats include the recovered session | ✅ |
| No console errors in any of the above | ✅ |
| Phone width: notice fits, no sideways scroll | ✅ |
| **Phone width: Dismiss button was 32 px tall** | ❌ → fixed to 44 px, measured |

## Known limitations (honest list)

| Limitation | Plan |
|---|---|
| **Two open tabs still don't follow each other.** Each saves its own timer; the last save wins on the next refresh | Block 8 |
| **A brief flash of `25:00`** before the saved timer appears on load, because saved data can only be read after the first render | Acceptable; the alternative is hiding the timer until loaded |
| **Notification permission isn't remembered** across refreshes | Unchanged from v0; revisited with notifications in Block 11 |
