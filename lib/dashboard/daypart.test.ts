import { describe, expect, it } from "vitest";
import { daypartAt } from "./daypart";

describe("daypartAt", () => {
  it("uses the learner's local hour at every boundary", () => {
    expect(daypartAt(new Date("2026-01-01T19:59:00Z"), "Asia/Tokyo")).toBe("lateEvening");
    expect(daypartAt(new Date("2026-01-01T20:00:00Z"), "Asia/Tokyo")).toBe("morning");
    expect(daypartAt(new Date("2026-01-02T02:59:00Z"), "Asia/Tokyo")).toBe("morning");
    expect(daypartAt(new Date("2026-01-02T03:00:00Z"), "Asia/Tokyo")).toBe("afternoon");
    expect(daypartAt(new Date("2026-01-02T08:00:00Z"), "Asia/Tokyo")).toBe("evening");
    expect(daypartAt(new Date("2026-01-02T12:00:00Z"), "Asia/Tokyo")).toBe("lateEvening");
  });

  it("derives the result from local time, not UTC", () => {
    const instant = new Date("2026-01-01T11:00:00Z");
    expect(daypartAt(instant, "Asia/Tokyo")).toBe("evening");
    expect(daypartAt(instant, "America/New_York")).toBe("morning");
  });
});
