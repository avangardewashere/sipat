# Block 5: Weekly stats

**Status:** ✅ done · 192 tests passing (36 new) + 5 daylight-saving tests in a separate timezone run

## What we built

| File | What it is |
|---|---|
| [`src/lib/stats/week.ts`](../../src/lib/stats/week.ts) | All the date maths: local days and weeks, focus per day, `formatFocus`, a clean axis |
| [`src/lib/stats/week.test.ts`](../../src/lib/stats/week.test.ts) | 23 tests in UTC+8 |
| [`src/lib/stats/week.dst.test.ts`](../../src/lib/stats/week.dst.test.ts) | 5 tests that only make sense where clocks change (New York) |
| [`scripts/test-in-timezone.mjs`](../../scripts/test-in-timezone.mjs) | Runs Jest in a chosen timezone, the same way on Windows, macOS and Linux |
| [`src/components/WeeklyStats.tsx`](../../src/components/WeeklyStats.tsx) | Stat tiles, the column chart, week navigation, table view |
| [`src/components/WeeklyStats.test.tsx`](../../src/components/WeeklyStats.test.tsx) | 12 component tests |

On the page: **This week**, its date range, arrows to step back through earlier weeks, three tiles
(Focus time · Sessions · Best day), a seven-column chart, and a **Show as table** toggle.

## The rules this block had to decide

| Question | Decision |
|---|---|
| When does a week start? | Monday, in the viewer's own timezone |
| A session from 23:50 to 00:15? | Its minutes split across both days: 10 and 15 |
| Which day does a session *count* on? | The day it ended. Ending exactly at midnight counts the day before |
| A session that was paused? | Focus is spread evenly across its span. Pauses aren't recorded, so this is an honest estimate, not a guess at when you paused |
| A session crossing Sunday midnight? | Minutes split across both weeks; the session counts in the week it ended |
| Two days tied for best? | The earlier one wins |

## Five ideas to take away

### 1. A day is not 24 hours
Days and weeks are built with `new Date(year, month, day)`, never by adding 24-hour chunks.
Where clocks change, a day can be 23 or 25 hours long. This is the same family of bug as Habibit's
`toISOString()` rule (which would put anything before 08:00 at UTC+8 on the previous day) — both
are now covered by tests.

### 2. A test in the wrong timezone can pass for the wrong reason
The daylight-saving test first *passed* while secretly running in Manila, which has no daylight
saving. Setting `process.env.TZ` inside a test does nothing: Jest gives each test file its own copy
of `process.env`, so the real process never sees it. The timezone has to be set **before Jest
starts**. Hence `npm run test:dst`, and the first test in that file asserts it really is running in
New York, so it can never quietly pass for the wrong reason again.

**This was not a theoretical worry.** Planting "add days as 24 hours" passed **all 192** normal
tests and was only caught by the New York run. Without that second run, the bug would have shipped
and broken one week a year for anyone whose clocks change.

### 3. Pick the chart's form before its colors
Minutes per day is magnitude over ordered time, so: a column chart. The weekly total is one
number, so: a stat tile, not a chart. Colors came last, and the blue was checked with a validator
against Sipat's actual light and dark backgrounds rather than judged by eye. Dark mode gets its own
step (`#3987e5`), not an automatic flip of the light one.

### 4. A chart nobody can see must still be readable
- Every column carries a text description: *"Mon, Sep 14: 50 min, 2 sessions"*.
- Columns are keyboard-focusable, and focus shows the same tooltip as hovering.
- **Show as table** gives the whole week as a real `<table>`, so no value is trapped in the graphic.
- Only the peak is labelled; the axis, the tooltip and the table carry the rest.

### 5. "Today" that survives midnight
The page could be open for hours. Instead of re-reading the clock, "today" is the later of *when
the page opened* and *the end of the newest session*. Finish a session at 00:20 and the chart
moves to the new day, and to the new week if it's Monday. One test covers exactly that.

## How we know the tests work

Each planted bug was run against both suites, which is what makes the timezone split visible:

| Planted bug | Manila run | New York run |
|---|---|---|
| Days added as 24 hours (the daylight-saving bug) | **all 192 passed** ⚠️ | 3 failed ✅ |
| Day key from `toISOString()` (the UTC bug) | 4 failed ✅ | passed |
| Weeks start on Sunday | 9 failed ✅ | 1 failed ✅ |
| No midnight split (all minutes on the end day) | 4 failed ✅ | passed |
| Session ending at midnight counted on the next day | 1 failed ✅ | passed |
| Best-day tie goes to the later day | 1 failed ✅ | passed |
| "Today" ignores sessions finished after midnight | 1 failed ✅ | passed |
| Next-week arrow not disabled | 1 failed ✅ | passed |
| A value label on every bar | 1 failed ✅ | passed |

Every file was restored and checked by hash afterwards.

## Checked in a real browser (things Jest can't prove)

Seeded with eight sessions across two weeks, including one deliberately crossing Saturday midnight:

| Check | Result |
|---|---|
| This week: 50 min, 2 sessions, best day Mon; axis 0 – 1 h | ✅ |
| Last week: Mon 50 · Tue 50 · Wed 25 · Fri 25 · **Sat 10 · Sun 15** · total 2 h 55 min · 6 sessions | ✅ exactly the hand-worked numbers, including the split session |
| The midnight-crossing session counts on Sunday (Sat shows "0 sessions" but 10 min) | ✅ |
| Hover shows a tooltip; it stays inside the screen at the edge columns | ✅ |
| Column marks: 20 px wide, 4 px rounded top, square baseline | ✅ measured |
| Dark mode uses `#3987e5`, light mode `#2a78d6` | ✅ measured |
| Week navigation back and forward; next disabled on the current week | ✅ |
| Phone width: no sideways scroll | ✅ |
| **Phone width: "2 h 55 min" wrapped onto two lines** | ❌ → fixed: the Focus time tile is wider, values never wrap, and a longer "12 h 45 min" was measured to fit |

## Known limitations (honest list)

| Limitation | Plan |
|---|---|
| **Weeks always start on Monday.** Some people expect Sunday | Could become a setting; the logic is one line |
| **A paused session's minutes are spread evenly across its span.** If you paused for an hour over midnight, the split is approximate | Recording pause times would fix it; not worth it yet |
| **"Today" only moves when a session finishes.** A page left open overnight with no sessions still shows yesterday until a refresh | A midnight timer could fix it; rare and harmless |
| **No streaks, no goals, no monthly view** | Not planned; say if you want them |

## Deliberately NOT in this block

| Not yet | Comes in |
|---|---|
| Keyboard shortcuts, empty-state polish, deleting sessions | Block 6 |
| Exporting your data | Not planned; a good candidate if you want it |
