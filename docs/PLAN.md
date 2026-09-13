# Sipat: plan

> **Sipat** (Tagalog) means *to aim, to line up your sights*. Tagline: **Aim. Align. Focus.**
> It's a focus timer that keeps a log of your sessions and shows weekly stats.

## Goal

Build a web app from an empty folder to a live release, **one small block at a time**, and
understand every step along the way.

## How we work

- **Small blocks.** Each block does one thing and ends in a working, deployed app.
- **Jest checks everything.** No manual QA. Every block adds tests, and a block is only done when
  `npm test` passes both locally and in CI.
- **Stop after each block.** You get a short "what we built and why" note, then take your time
  before the next block starts.
- **Honest about gaps.** Some things Jest can't prove, like a real browser playing a sound or a
  background tab keeping time. Claude checks those in a real browser and lists them in the
  block's notes.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Same as Habibit, so the new learning is testing and the app itself |
| Styling | Tailwind CSS 4 | Same as Habibit |
| Language | TypeScript | Mistakes show up before they run |
| Unit tests | Jest 30 via `next/jest` | Asked for by name |
| Component tests | React Testing Library + jest-dom | Tests click and read the page the way a user does |
| CI | GitHub Actions | Every push runs lint, typecheck, tests and build |
| Hosting | Vercel (free tier) | Same as Habibit |

## Blocks

**Progress:** Block 0 ✅ (live at https://sipat-jade.vercel.app) · Block 1 ✅ ([notes](blocks/block-1.md)) · Block 2 ✅ ([notes](blocks/block-2.md)) · Block 3 ✅ ([notes](blocks/block-3.md)) · Block 4 ✅ ([notes](blocks/block-4.md))

| # | Block | What we build | What you learn | How Jest checks it |
|---|---|---|---|---|
| 0 | **Skeleton that ships** | Empty app, Jest set up, one test, CI, deployed | Ship on day one so every later block goes live | A sample test passes locally and in CI |
| 1 | **Timer engine** | Pure logic with no UI: idle → running → paused → finished | Time comes from **timestamps**, not a "subtract 1 every second" counter, which drifts in background tabs | Fake timers and a mocked clock |
| 2 | **Timer UI** | Big `mm:ss` display, start/pause/reset, time left in the tab title | Testing components through what the user sees and clicks | Testing Library clicks and reads the screen |
| 3 | **Pomodoro cycles** | Focus → short break, with a long break after every 4th focus session; editable lengths; a sound or notification at the end | Modelling a sequence as a state machine | Tests walk through a full 4-session cycle |
| 4 | **Session log** | Finished focus sessions are saved and kept after a refresh | Storage behind an **interface**, so localStorage can later be swapped for a real database | In-memory fake store; corrupted and missing data |
| 5 | **Weekly stats** | Focus minutes per day, weekly total, bar chart | Grouping by *local* date without timezone bugs | Sessions that cross midnight, week edges, UTC+8 |
| 6 | **Polish + v0 release** | Empty states, keyboard shortcuts, README, final deploy | What "shipped" means beyond "it runs" | Full suite passes in CI |

## Decisions

| Decision | Choice | Status |
|---|---|---|
| Name | Sipat | ✅ chosen by you |
| Save data in v0 | Yes, localStorage behind an async repository (Block 4) | ✅ done |
| Timer lengths | Focus 25 · short break 5 · long break 15 · long break every 4 sessions | ✅ defaults, editable in Settings (Block 3) |

## Rules carried over from Habibit

- **Day keys use local calendar parts**, never `toISOString()`, which gives the wrong day at UTC+8.
- **Keep components swappable.** Keep side effects out of UI components.
- **Test devices:** Android and desktop. iOS should work but is never a required check.
