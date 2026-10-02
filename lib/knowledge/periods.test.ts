import { describe, expect, it } from "vitest";
import { nextUtcMidnight, nextUtcMonth, utcDay, utcMonth } from "./periods";

describe("UTC periods", () => {
  // 23:30 on the last day of the month in Hanoi is still 16:30 UTC of the same day.
  const hanoiLate = new Date("2026-10-31T16:30:00.000Z");
  const utcLate = new Date("2026-12-31T23:59:59.999Z");

  it("names the UTC day and month", () => {
    expect(utcDay(hanoiLate)).toBe("2026-10-31");
    expect(utcMonth(hanoiLate)).toBe("2026-10-01");
    expect(utcDay(utcLate)).toBe("2026-12-31");
  });

  it("resets at the next UTC midnight and the next UTC month", () => {
    expect(nextUtcMidnight(hanoiLate).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(nextUtcMonth(hanoiLate).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(nextUtcMidnight(utcLate).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(nextUtcMonth(utcLate).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
