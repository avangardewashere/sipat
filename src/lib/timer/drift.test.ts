/**
 * @jest-environment node
 */
/**
 * Why the engine uses timestamps: a side-by-side demo.
 *
 * Both timers below are driven by a real setInterval, the way the UI will be in Block 2.
 * Jest's fake timers replace setInterval and Date.now() with a clock we control:
 *
 *   jest.advanceTimersByTime(ms)  moves the clock forward AND fires any timers due
 *                                 (a normal, focused tab)
 *   jest.setSystemTime(ms)        moves the clock WITHOUT firing timers
 *                                 (a throttled background tab or a sleeping laptop)
 */

import { createTimer, getRemainingMs, timerReducer, type TimerState } from "./timer";

const SEC = 1_000;
const MIN = 60 * SEC;

/** The approach we did NOT take: subtract one second on every tick. */
function startNaiveCountdown(durationMs: number) {
  const counter = { remainingMs: durationMs };
  setInterval(() => {
    counter.remainingMs = Math.max(0, counter.remainingMs - SEC);
  }, SEC);
  return counter;
}

/** Our engine, ticked on the same interval. It reads the clock instead of counting. */
function startEngineCountdown(durationMs: number) {
  const holder: { state: TimerState } = {
    state: timerReducer(createTimer(durationMs), { type: "start", now: Date.now() }),
  };
  setInterval(() => {
    holder.state = timerReducer(holder.state, { type: "tick", now: Date.now() });
  }, SEC);
  return holder;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 8, 14, 9, 0, 0));
});

afterEach(() => {
  jest.useRealTimers();
});

it("in a focused tab, both approaches agree", () => {
  const naive = startNaiveCountdown(25 * MIN);
  const engine = startEngineCountdown(25 * MIN);

  jest.advanceTimersByTime(10 * MIN);

  expect(naive.remainingMs).toBe(15 * MIN);
  expect(getRemainingMs(engine.state, Date.now())).toBe(15 * MIN);
});

it("in a throttled background tab, the naive counter drifts but the engine stays correct", () => {
  const naive = startNaiveCountdown(25 * MIN);
  const engine = startEngineCountdown(25 * MIN);

  // Chrome can limit hidden tabs to about one timer run per minute. Simulate 10 minutes of that:
  // 59 seconds pass with no timers firing, then 1 second in which a single tick fires.
  for (let minute = 0; minute < 10; minute++) {
    jest.setSystemTime(Date.now() + 59 * SEC);
    jest.advanceTimersByTime(1 * SEC);
  }

  // 10 real minutes passed, but the naive counter only saw 10 ticks: it thinks 10 SECONDS passed.
  expect(naive.remainingMs).toBe(25 * MIN - 10 * SEC);
  expect(getRemainingMs(engine.state, Date.now())).toBe(15 * MIN);
});

it("after the laptop sleeps past the deadline, the engine finishes at the true end time", () => {
  const startedAt = Date.now();
  const naive = startNaiveCountdown(25 * MIN);
  const engine = startEngineCountdown(25 * MIN);

  jest.setSystemTime(startedAt + 60 * MIN); // lid closed for an hour, no ticks at all
  jest.advanceTimersByTime(1 * SEC); // lid opens, one tick fires

  expect(naive.remainingMs).toBe(25 * MIN - 1 * SEC); // still thinks the session just began
  expect(engine.state).toEqual({ status: "finished", durationMs: 25 * MIN, finishedAt: startedAt + 25 * MIN });
});
