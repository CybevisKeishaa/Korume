import { describe, expect, it } from "vitest";
import {
  reviewItem,
  INITIAL_STATE,
  MIN_EASE_FACTOR,
  DEFAULT_EASE_FACTOR,
  type SrsState,
} from "./sm2";

const NOW = new Date("2026-07-12T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("reviewItem — successful reviews", () => {
  it("schedules a brand-new item 1 day out on the first pass", () => {
    const r = reviewItem(INITIAL_STATE, 5, NOW);
    expect(r.repetitions).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(r.easeFactor).toBeCloseTo(2.6, 5); // 2.5 + 0.1
    expect(r.nextReviewAt.getTime()).toBe(NOW.getTime() + 1 * DAY);
    expect(r.lastReviewedAt).toEqual(NOW);
  });

  it("schedules the second pass 6 days out", () => {
    const afterFirst: SrsState = { repetitions: 1, intervalDays: 1, easeFactor: 2.6 };
    const r = reviewItem(afterFirst, 5, NOW);
    expect(r.repetitions).toBe(2);
    expect(r.intervalDays).toBe(6);
    expect(r.nextReviewAt.getTime()).toBe(NOW.getTime() + 6 * DAY);
  });

  it("uses round(interval · EF) from the third pass onward", () => {
    const mature: SrsState = { repetitions: 2, intervalDays: 6, easeFactor: 2.5 };
    const r = reviewItem(mature, 5, NOW);
    // EF -> 2.6, interval -> round(6 * 2.6) = 16
    expect(r.easeFactor).toBeCloseTo(2.6, 5);
    expect(r.intervalDays).toBe(16);
    expect(r.repetitions).toBe(3);
  });

  it("quality 4 leaves EF unchanged; quality 3 lowers it", () => {
    expect(reviewItem(INITIAL_STATE, 4, NOW).easeFactor).toBeCloseTo(2.5, 5);
    expect(reviewItem(INITIAL_STATE, 3, NOW).easeFactor).toBeCloseTo(2.36, 5);
  });
});

describe("reviewItem — lapses (quality < 3)", () => {
  it("restarts the schedule and leaves EF unchanged", () => {
    const mature: SrsState = { repetitions: 5, intervalDays: 40, easeFactor: 2.7 };
    const r = reviewItem(mature, 1, NOW);
    expect(r.repetitions).toBe(0);
    expect(r.intervalDays).toBe(1);
    expect(r.easeFactor).toBe(2.7); // unchanged on lapse
    expect(r.nextReviewAt.getTime()).toBe(NOW.getTime() + 1 * DAY);
  });

  it("treats quality 2 as a lapse and quality 3 as a pass (boundary)", () => {
    expect(reviewItem(INITIAL_STATE, 2, NOW).repetitions).toBe(0);
    expect(reviewItem(INITIAL_STATE, 3, NOW).repetitions).toBe(1);
  });
});

describe("reviewItem — ease factor floor", () => {
  it("never drops below 1.3 even after repeated low grades", () => {
    let state: SrsState = { ...INITIAL_STATE };
    for (let i = 0; i < 20; i++) {
      const r = reviewItem(state, 3, NOW);
      state = {
        repetitions: r.repetitions,
        intervalDays: r.intervalDays,
        easeFactor: r.easeFactor,
      };
    }
    expect(state.easeFactor).toBe(MIN_EASE_FACTOR);
  });
});

describe("reviewItem — validation", () => {
  it("rejects out-of-range or non-integer quality", () => {
    expect(() => reviewItem(INITIAL_STATE, 6 as never, NOW)).toThrow(RangeError);
    expect(() => reviewItem(INITIAL_STATE, -1 as never, NOW)).toThrow(RangeError);
    expect(() => reviewItem(INITIAL_STATE, 2.5 as never, NOW)).toThrow(RangeError);
  });

  it("exposes sane defaults", () => {
    expect(DEFAULT_EASE_FACTOR).toBe(2.5);
    expect(INITIAL_STATE.repetitions).toBe(0);
  });
});
