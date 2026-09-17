# Sipat

**Aim. Align. Focus.** A Pomodoro focus timer that keeps a log of your sessions and shows your week.

*Sipat* is Tagalog for *to aim, to line up your sights*.

**Live:** https://sipat-jade.vercel.app

## What it does

- **Focus timer** that stays accurate in background tabs and after a laptop sleeps
- **Pomodoro cycles:** focus → short break, with a long break after every 4th session. Every length is adjustable
- **Time's-up alerts:** a chime, vibration on phones, and optional system notifications
- **Session log:** every completed focus session is saved in your browser. Delete one (with undo) or clear everything
- **Weekly stats:** focus time, sessions and best day, a daily chart, earlier weeks, and a table view
- **Keyboard shortcuts:** <kbd>Space</kbd> start/pause · <kbd>R</kbd> reset · <kbd>S</kbd> skip

Your data never leaves your browser. There's no account and no server storage.

## Tech

| Piece | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Storage | `localStorage`, behind an async repository so a real database can replace it later |
| Tests | Jest 30 + React Testing Library + user-event + jest-axe |
| CI | GitHub Actions: lint, typecheck, tests (in two timezones), build |
| Hosting | Vercel |

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run all tests once (in UTC+8) |
| `npm run test:dst` | Run the daylight-saving date tests in New York time |
| `npm run test:watch` | Re-run tests whenever a file changes |
| `npm run typecheck` | Generate Next.js route types, then type-check with `tsc` |
| `npm run lint` | Run ESLint |
| `npm run build` | Production build |

## How the code is laid out

```
src/
  app/                 page, layout, icon, page-level and accessibility tests
  components/          Pomodoro (the screen), SettingsPanel, WeeklyStats, SessionLog
  hooks/               React glue: usePomodoro, useStoredData, useDocumentTitle, useKeyboardShortcuts, …
  lib/
    timer/             the timer engine: pure, timestamp-based (Block 1)
    pomodoro/          the focus/break cycle, settings, saved preferences (Blocks 3–4)
    alerts/            chime, vibration, notifications behind one interface (Block 3)
    sessions/          the stored session record and its format (Block 4)
    storage/           key-value store + repository (Block 4)
    stats/             local-week date maths (Block 5)
    shortcuts/         which key does what (Block 6)
scripts/               test-in-timezone.mjs
docs/                  PLAN.md and one notes file per block
```

The rule that holds it together: **logic lives in `lib/` as pure functions with no React and no
clock reads.** Components and hooks only connect that logic to the screen and the browser. That's
why most tests run in milliseconds without rendering anything.

## How it's tested

- **Every test uses a fixed timezone** (UTC+8), and date logic is tested again in New York time,
  where days can be 23 or 25 hours long.
- **Time is simulated, not waited for.** Jest's fake timers move the clock forward, so a 25-minute
  session takes milliseconds to test.
- **Components are tested the way people use them:** by role and label, clicking and typing
  with user-event.
- **Accessibility is checked automatically** with axe-core on the main page states.
- **The tests were themselves tested.** In every block, realistic bugs were planted one at a time
  to confirm a test fails for each. The results are in each block's notes.

## How it was built

In seven small blocks, each tested, deployed and written up before the next began:

| Block | What | Notes |
|---|---|---|
| 0 | Skeleton that ships: Next.js, Jest, CI, Vercel | [plan](docs/PLAN.md) |
| 1 | Timer engine | [notes](docs/blocks/block-1.md) |
| 2 | Timer UI | [notes](docs/blocks/block-2.md) |
| 3 | Pomodoro cycles, settings and alerts | [notes](docs/blocks/block-3.md) |
| 4 | Session log saved to the browser | [notes](docs/blocks/block-4.md) |
| 5 | Weekly stats | [notes](docs/blocks/block-5.md) |
| 6 | Polish and v0 release | [notes](docs/blocks/block-6.md) |

## Known limitations

- Refreshing the page resets a timer that's running. Finished sessions and settings are kept.
- Data lives in one browser. There's no sync between devices.
- Android Chrome can't show system notifications without an installed app; you get sound and
  vibration instead.
- In a background tab, the chime can arrive up to about a minute late. The recorded times are still exact.
- Weeks start on Monday.
