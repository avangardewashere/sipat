# Block 3: Pomodoro cycles

**Status:** ✅ done · 108 tests passing (55 new) · the live site runs full focus/break cycles with editable lengths and a chime

## What we built

| File | What it is |
|---|---|
| [`src/lib/pomodoro/settings.ts`](../../src/lib/pomodoro/settings.ts) | Phases, default lengths, allowed ranges, `validateSettings` |
| [`src/lib/pomodoro/pomodoro.ts`](../../src/lib/pomodoro/pomodoro.ts) | The cycle reducer: which phase comes next, completions, skip, settings changes |
| [`src/lib/alerts/browser.ts`](../../src/lib/alerts/browser.ts) | Chime (Web Audio), vibration, system notifications, behind one `Alerts` interface |
| [`src/hooks/usePomodoro.ts`](../../src/hooks/usePomodoro.ts) | Block 2's `useTimer`, renamed and now driving the whole cycle |
| [`src/hooks/useCompletionEffect.ts`](../../src/hooks/useCompletionEffect.ts) | Runs the alert exactly once per completed phase |
| [`src/hooks/useDocumentTitle.ts`](../../src/hooks/useDocumentTitle.ts) | Now also *guards* the title (see "The bug Jest couldn't see") |
| [`src/components/Pomodoro.tsx`](../../src/components/Pomodoro.tsx) | Block 2's `Timer`, renamed: phase heading, progress dots, Skip button |
| [`src/components/SettingsPanel.tsx`](../../src/components/SettingsPanel.tsx) | Lengths form, sound toggle, notification toggle |

Tests: `settings.test.ts` (13), `pomodoro.test.ts` (20), `browser.test.ts` (8), `Pomodoro.test.tsx` (29, replacing the Block 2 Timer tests), `page.test.tsx` (2).

```
 focus ──done──► short break ──done──► focus ──done──► … 4th focus done ──► long break ──done──► focus
   │                  │
   └──skip──► short break (not counted, no chime)     break ──skip──► focus
```

Every arrow lands on an **idle** phase. Nothing starts until you press Start.

## Seven ideas to take away

### 1. Build on top; don't rewrite
The Block 1 timer engine didn't change at all. `pomodoroReducer` *contains* a timer and passes
start/pause/tick/reset straight to `timerReducer`. It only adds what a cycle needs: which phase
comes next. The Block 1 engine and drift tests still pass without a single change.

### 2. Reducers record events; effects react to them
A reducer must stay pure, so it can't play a sound. When a phase finishes, it records
`lastCompletion` with a rising `seq` number. `useCompletionEffect` notices a new `seq` after React
renders and plays the chime. The ref remembering the last handled `seq` means a re-render can
never replay an old chime. A test checks it plays **exactly once**.

### 3. Side effects behind an interface
The component receives an `alerts` object (`chime`, `vibrate`, `notify`, …) instead of calling
browser APIs itself. The app passes the real ones; tests pass `jest.fn()` fakes and check what was
called. Swapping in service-worker notifications later won't touch the UI.

### 4. Forms hold text; the app holds numbers
The settings form edits a *draft* of raw strings. Only `validateSettings` turns text into numbers,
and it rejects `""`, `2.5`, `-5` or `999` with a message instead of guessing. `noValidate` turns off
the browser's own pop-ups so every browser shows the same accessible messages
(`aria-invalid` + `aria-describedby`).

### 5. Browsers make you earn sound and notifications
- **Sound** can only be switched on from a click, so Start calls `alerts.unlockSound()`.
- **Notifications** need permission, and asking for it is **async**. The checkbox only ticks after
  the browser answers. Tests use `waitFor` to wait for that.

### 6. `useEffectEvent` (new in React 19.2)
The completion handler reads the latest `soundOn`, `notifyOn` and phase without being listed as an
effect dependency. Without it the effect would re-run on every render, or read stale values.

### 7. A green test suite isn't the whole truth
Two problems got past a passing run this block. Both were only caught by looking more carefully:

| What slipped through | How it was found | Lesson |
|---|---|---|
| **The tab title** showed `Sipat` instead of `Focus · Sipat` on page load | Opening the page in a real browser | Jest's jsdom doesn't include Next.js's `<head>` handling. Some bugs only exist in the real thing |
| **An `act()` warning** in the notification tests | Reading the full test output | My warning check searched for "Warning", but React's message says "not configured to support act(...)". Search for `console.error`, not one word |

## The bug Jest couldn't see

**Symptom:** on load, the tab said `Sipat`. After the first click it corrected itself.

**Investigation:**
1. Clicking Skip twice set the title correctly, so only the **first** write was being lost.
2. The same happened in a **production build**, so it wasn't a dev-mode quirk.
3. Next.js renders its own `<title>` from `metadata` in `layout.tsx`. That title finished hydrating
   *after* our effect's first write and replaced it.

**First fix attempt (reverted):** render `<title>` from the component, which React 19 moves into
`<head>`. React's source shows it inserts each new title *before* existing ones, so the **last to
mount wins**. In the browser Next's title still won, and there were duplicate `<title>` elements.

**Final fix:** `useDocumentTitle` watches `<head>` with a `MutationObserver`. If anything replaces
the title while the timer is on screen, the hook writes it straight back. It stops watching on
unmount. A test now reproduces the bug by overwriting the title after mount, and planting the bug
(removing the write-back) makes that test fail.

## Decisions made in this block

| Decision | Why |
|---|---|
| Phases don't start on their own | You decide when a break starts. An auto-start option could come later |
| Skipping never counts as a session and never earns a long break | Skipping isn't focusing. Block 4 will only log completed sessions |
| Editing settings mid-phase keeps the current phase's length | Changing 25→50 minutes halfway through would be confusing. A hint tells you it applies next phase |
| Reset restarts the current phase only | Starting the whole cycle over is rarer and can be added if wanted |
| Allowed ranges: focus 1–180, breaks 1–60, long break every 2–12 sessions | "Every 1" would make every break long |
| Notifications off by default; permission asked only when you tick the box | Asking the moment the page loads is annoying and usually gets refused |
| Chime generated with Web Audio, no sound file | Nothing to download or load |
| Sound and vibration share one toggle | Vibration is the phone version of the chime |

## How we know the tests work

| Planted bug | Tests that failed |
|---|---|
| Skipping the 4th focus still earns a long break | 3 |
| Long break comes after the wrong session | 14 |
| New settings cut into a running phase | 3 |
| Sound toggle ignored | 1 |
| Settings accept decimals like `2.5` | 2 |
| Android's notification crash not caught | 1 |
| Title guard removed (the real-browser bug) | 1 |

Every bug was caught, and the files were restored (checked by hash). Two of my first attempts at
planting bugs didn't produce a valid test: one broke the file's syntax, and one changed nothing
because Git Bash rewrote the regex argument. I redid both with exact string replacements, so
every row above is a real failure against compiling code.

## Checked in a real browser (things Jest can't prove)

| Check | Result |
|---|---|
| Page loads; no console errors | ✅ |
| Tab title on first load is `Focus · Sipat` | ✅ after the fix (was ❌ `Sipat`, dev *and* production build) |
| Settings: set focus to 1, Save → `01:00`, "Saved" shown | ✅ |
| Start → "Changes apply from the next phase" hint appears | ✅ |
| 1 real minute later → Short break, `05:00`, Ready, "1 of 4 sessions done", title `Short break · Sipat` | ✅ at 60 s |
| Chime really played through the Web Audio API | ✅ three oscillators created exactly once: 880, 660, 990 Hz |
| Skip focus / Skip break switch phases and titles | ✅ |
| Phone width (375 px): no sideways scroll, buttons wrap to 2 rows, 48 px buttons, 44 px checkbox rows | ✅ measured |
| Actually *hearing* the chime | ⚠️ Can't hear from here. The audio nodes were created and started; please listen on your devices |
| System notification appearing | ⚠️ The automated browser can't answer a permission prompt. Covered by Jest with fakes |
| Vibration on Android | ⚠️ Needs your phone. Covered by Jest with a fake |

## Known limitations (honest list)

| Limitation | Why | Plan |
|---|---|---|
| **Android Chrome: no system notification** | Android only allows notifications from a service worker (installed-app feature). The app catches the error, still chimes and vibrates, and explains why | A service worker could come with an "install as app" block later |
| **Alert can be up to ~1 minute late in a background tab** | Browsers throttle timers in hidden tabs. The phase switch and recorded end time are still *correct* (Block 1), but the chime waits for the next allowed tick | Could schedule the chime ahead with Web Audio's own clock; not planned yet |
| **Refreshing the page resets the timer and settings** | Nothing is saved yet | Settings saving fits Block 4; resuming a running timer after refresh is still undecided |

## Deliberately NOT in this block

| Not yet | Comes in |
|---|---|
| Saving completed sessions and settings | Block 4 |
| Weekly stats | Block 5 |
| Keyboard shortcuts, empty states, polish | Block 6 |
| Auto-start next phase, "reset whole cycle" | Not planned; easy to add if wanted |
