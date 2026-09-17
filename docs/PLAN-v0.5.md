# Sipat v0.5: plan

> **Theme: reliable everywhere.** v0 works well while its tab stays open. v0.5 keeps working when you
> refresh, open a second tab, lock your phone, or lose your connection.

**Progress:** Block 7 ✅ ([notes](blocks/block-7.md))

## Scope

| Feature | Fixes this v0 limitation |
|---|---|
| **A. Resume after refresh** | Refreshing or closing the tab wipes a running timer |
| **B. Live sync between tabs** | Two open tabs disagree until refreshed |
| **C. Chime on time in background tabs** | The chime can be ~1 minute late in a hidden tab |
| **D. Installable app (PWA) + offline** | No system notifications on Android; nothing works offline |
| **F. Week start setting** | Weeks always start on Monday |

**Not in v0.5** (candidates for v0.6): E export/import, G daily goal + streaks, accounts and sync between devices.

## How we work (unchanged from v0)

Small blocks, Jest tests for each, planted bugs to prove the tests work, real-browser checks for
what Jest can't prove, notes in `docs/blocks/`, pushed to `master` so it's live, and a **stop after
every block**. Block numbers continue from v0.

## Blocks

| # | Block | What we build | What you learn |
|---|---|---|---|
| 7 | **Resume after refresh** (A) | Save the timer and cycle state on every change; restore it on load. A session that ended while Sipat was closed is logged with its real end time | Saving state as it changes; a second stored format; Block 1's timestamps paying off |
| 8 | **Live sync between tabs** (B) | Tabs react to each other's changes to sessions, settings and the running timer. Only one tab plays the alert | The `storage` event; why timestamp-based state makes two tabs agree automatically; electing one tab with the Web Locks API |
| 9 | **Chime on time** (C) | When a phase starts, the chime is scheduled ahead on the audio clock; pause, reset and skip cancel it | Why the audio clock isn't throttled like timers are; testing scheduled audio with a fake `AudioContext` |
| 10 | **Installable + offline** (D, part 1) | Web app manifest, app icons, a service worker that caches the app so it opens with no connection | Service workers, cache strategies, what "installable" requires; keeping service-worker logic in testable pure functions |
| 11 | **Notifications through the service worker** (D, part 2) | Time's-up notifications via the service worker, which is what Android Chrome requires | Why Android refuses page notifications; permission flows in an installed app |
| 12 | **Week start + v0.5 release** (F) | Monday/Sunday setting threaded through the stats; README, notes, `v0.5.0` tag and release | Re-using date logic you already trust; the DST test run proves the new option too |

## Decisions to confirm

Each block starts by confirming its own decisions. These are the recommended defaults:

| Block | Question | Recommended default |
|---|---|---|
| 7 | A focus session ended while Sipat was closed: chime when it reopens? | **No.** Log it silently with its real end time, and show a short notice ("Your focus session finished at 10:25") |
| 7 | A timer was paused when the tab closed | Restore it paused, exactly where it was |
| 8 | Two tabs both running: which one alerts? | **Only one tab** (chosen with Web Locks); the others just update |
| 8 | Two tabs press Start at almost the same time | The later save wins; both tabs then show it |
| 10 | Which pages work offline? | The whole app, since it's one page and all data is already local |
| 11 | Notifications when the app is completely closed? | **Not in v0.5.** That needs a push server (VAPID keys, storing subscriptions), which goes against "your data stays in your browser". Notifications work while the app is open or in the background |

## Honest expectations up front

- **Jest can't run a real service worker or a real install.** Blocks 10–11 keep the service worker's
  decisions (what to cache, what to serve offline) in pure functions that Jest tests, then check the
  real thing in the browser: offline mode, installability, and notifications on your Android phone.
  Those browser checks matter more in these blocks than in any earlier one.
- **Phones may still delay alerts when the screen is off.** Android can pause a backgrounded page or
  app to save battery. Blocks 9 and 11 make alerts as reliable as a web app can be; the notes will
  say exactly what was verified on your phone.
- **iOS:** notifications only work for an app added to the Home Screen (iOS 16.4+). Sipat will
  support it, but with no iOS device here, it's never a required check.

## Rules carried over

- Day keys come from local calendar parts, never `toISOString()`; days are never "+24 hours".
- Logic stays in `src/lib` as pure functions; side effects stay behind small interfaces.
- Stored formats are versioned; unreadable data is backed up, never silently dropped.
- Test devices: Android and desktop.
