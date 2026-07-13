import { describe, expect, it } from "vitest";
import { vnDateString, advanceStreak } from "./streak";
import type { StreakState } from "./types";

describe("vnDateString — Asia/Ho_Chi_Minh (UTC+7, no DST) conversion", () => {
  it("converts a UTC midday instant to the same VN calendar date", () => {
    expect(vnDateString(new Date("2026-07-12T04:00:00.000Z"))).toBe("2026-07-12");
  });

  it("rolls over to the next VN day for late-UTC evening instants (>= 17:00 UTC)", () => {
    // 17:00 UTC + 7h = 00:00 VN the next day.
    expect(vnDateString(new Date("2026-07-12T17:00:00.000Z"))).toBe("2026-07-13");
  });

  it("stays on the same VN day just before the rollover (16:59 UTC)", () => {
    expect(vnDateString(new Date("2026-07-12T16:59:59.999Z"))).toBe("2026-07-12");
  });

  it("handles VN 23:59 (16:59 UTC) vs VN 00:01 (17:01 UTC) as different days", () => {
    const vn2359 = vnDateString(new Date("2026-07-12T16:59:00.000Z"));
    const vn0001 = vnDateString(new Date("2026-07-12T17:01:00.000Z"));
    expect(vn2359).toBe("2026-07-12");
    expect(vn0001).toBe("2026-07-13");
  });

  it("handles a UTC month/year boundary correctly", () => {
    // 2026-01-01T17:30Z -> VN 2026-01-02
    expect(vnDateString(new Date("2026-01-01T17:30:00.000Z"))).toBe("2026-01-02");
    // 2025-12-31T17:30Z -> VN 2026-01-01
    expect(vnDateString(new Date("2025-12-31T17:30:00.000Z"))).toBe("2026-01-01");
  });
});

describe("advanceStreak", () => {
  const NULL_STATE: StreakState = { current: 0, longest: 0, lastActiveDate: null };

  it("starts a streak at 1 on first-ever activity", () => {
    const now = new Date("2026-07-12T04:00:00.000Z"); // VN 2026-07-12
    const r = advanceStreak(NULL_STATE, now);
    expect(r).toEqual({ current: 1, longest: 1, lastActiveDate: "2026-07-12" });
  });

  it("leaves the streak unchanged for a second activity the same VN day", () => {
    const prev: StreakState = { current: 3, longest: 5, lastActiveDate: "2026-07-12" };
    const laterSameDay = new Date("2026-07-12T16:00:00.000Z"); // still VN 2026-07-12
    const r = advanceStreak(prev, laterSameDay);
    expect(r).toEqual(prev);
  });

  it("increments the streak on the very next VN-consecutive day", () => {
    const prev: StreakState = { current: 3, longest: 5, lastActiveDate: "2026-07-12" };
    const nextDay = new Date("2026-07-13T04:00:00.000Z"); // VN 2026-07-13
    const r = advanceStreak(prev, nextDay);
    expect(r).toEqual({ current: 4, longest: 5, lastActiveDate: "2026-07-13" });
  });

  it("updates `longest` when the new current streak surpasses it", () => {
    const prev: StreakState = { current: 5, longest: 5, lastActiveDate: "2026-07-12" };
    const nextDay = new Date("2026-07-13T04:00:00.000Z");
    const r = advanceStreak(prev, nextDay);
    expect(r).toEqual({ current: 6, longest: 6, lastActiveDate: "2026-07-13" });
  });

  it("resets the streak to 1 after a gap of more than one VN day", () => {
    const prev: StreakState = { current: 10, longest: 12, lastActiveDate: "2026-07-01" };
    const now = new Date("2026-07-12T04:00:00.000Z");
    const r = advanceStreak(prev, now);
    expect(r).toEqual({ current: 1, longest: 12, lastActiveDate: "2026-07-12" });
  });

  it("resets to 1 when lastActiveDate is null", () => {
    const now = new Date("2026-07-12T04:00:00.000Z");
    const r = advanceStreak(NULL_STATE, now);
    expect(r.current).toBe(1);
  });

  it("preserves `longest` across a reset even when it exceeds the new current", () => {
    const prev: StreakState = { current: 20, longest: 20, lastActiveDate: "2026-01-01" };
    const now = new Date("2026-07-12T04:00:00.000Z");
    const r = advanceStreak(prev, now);
    expect(r.current).toBe(1);
    expect(r.longest).toBe(20);
  });

  it("treats consecutive-day activity across the UTC day line correctly (VN 23:59 -> VN 00:01 next day)", () => {
    // First activity at VN 2026-07-12 23:59 (16:59 UTC same date)
    const first = new Date("2026-07-12T16:59:00.000Z");
    const afterFirst = advanceStreak(NULL_STATE, first);
    expect(afterFirst.lastActiveDate).toBe("2026-07-12");

    // Second activity 2 minutes later in absolute time, but VN 2026-07-13 00:01 (17:01 UTC)
    const second = new Date("2026-07-12T17:01:00.000Z");
    const afterSecond = advanceStreak(afterFirst, second);
    expect(afterSecond).toEqual({ current: 2, longest: 2, lastActiveDate: "2026-07-13" });
  });

  it("does not double-count same-VN-day activity even if it spans a UTC midnight (e.g. 23:00 UTC and 01:00 UTC same VN day)", () => {
    // VN day 2026-07-13 spans UTC 2026-07-12T17:00 to 2026-07-13T16:59:59.999
    const first = new Date("2026-07-12T23:00:00.000Z"); // VN 2026-07-13 06:00
    const afterFirst = advanceStreak(NULL_STATE, first);
    expect(afterFirst.lastActiveDate).toBe("2026-07-13");

    const second = new Date("2026-07-13T01:00:00.000Z"); // VN 2026-07-13 08:00, same VN day
    const afterSecond = advanceStreak(afterFirst, second);
    expect(afterSecond).toEqual(afterFirst);
  });
});
