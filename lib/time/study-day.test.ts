import { describe, expect, it } from "vitest";
import {
  addDays, canonicalTimeZone, daysBetween, FALLBACK_STUDY_TIMEZONE, isoWeekday, nextStudyDayStart, studyDate,
  studyDayStart, studyDaysAgo,
} from "./study-day";

const HCM = "Asia/Ho_Chi_Minh";
const LA = "America/Los_Angeles";

describe("study-day", () => {
  it("puts one instant on different local days", () => {
    const instant = new Date("2026-10-07T03:00:00Z");
    expect(studyDate(instant, HCM)).toBe("2026-10-07");
    expect(studyDate(instant, LA)).toBe("2026-10-06");
  });
  it("starts a Ho Chi Minh day at 17:00Z the day before", () => {
    expect(studyDayStart("2026-10-07", HCM).toISOString()).toBe("2026-10-06T17:00:00.000Z");
  });
  it("respects 23-hour and 25-hour DST days", () => {
    const hours = (date: string) =>
      (studyDayStart(addDays(date, 1), LA).getTime() - studyDayStart(date, LA).getTime()) / 3_600_000;
    expect(hours("2026-03-08")).toBe(23);
    expect(hours("2026-11-01")).toBe(25);
  });
  it("finds the first existing instant when DST skips local midnight", () => {
    expect(studyDayStart("2026-09-06", "America/Santiago").toISOString()).toBe("2026-09-06T04:00:00.000Z");
  });
  it("finds the next local midnight", () => {
    expect(nextStudyDayStart(new Date("2026-10-04T16:59:00Z"), HCM).toISOString()).toBe("2026-10-04T17:00:00.000Z");
  });
  it("counts calendar days across midnight and year end", () => {
    expect(studyDaysAgo(new Date("2026-10-06T16:59:00Z"), new Date("2026-10-06T17:00:00Z"), HCM)).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(isoWeekday("2026-10-11")).toBe(7);
  });
  it("canonicalizes accepted zones and rejects invalid input", () => {
    const canonical = canonicalTimeZone(HCM);
    expect(canonical).not.toBeNull();
    expect(canonicalTimeZone("asia/ho_chi_minh")).toBe(canonical);
    expect(canonicalTimeZone("US/Pacific")).toBe(canonicalTimeZone(LA));
    expect(canonicalTimeZone("Not/AZone")).toBeNull();
    expect(canonicalTimeZone("")).toBeNull();
    expect(canonicalTimeZone("x".repeat(65))).toBeNull();
    expect(canonicalTimeZone(FALLBACK_STUDY_TIMEZONE)).not.toBeNull();
  });
});
