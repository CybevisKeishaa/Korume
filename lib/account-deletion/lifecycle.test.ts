import { describe, expect, it } from "vitest";
import { GRACE_DAYS, PURGE_DAYS, canCancel, isDue, scheduleFor } from "./lifecycle";

const AT = new Date("2026-08-20T10:00:00.000Z");

describe("scheduleFor", () => {
  it("puts execution GRACE_DAYS after the request, for both tiers", () => {
    const expected = new Date("2026-08-27T10:00:00.000Z");
    expect(scheduleFor("erase_all", AT).executeAfter).toEqual(expected);
    expect(scheduleFor("close_account", AT).executeAfter).toEqual(expected);
    expect(GRACE_DAYS).toBe(7);
  });

  it("schedules a purge only for erase_all, PURGE_DAYS after the request", () => {
    expect(scheduleFor("erase_all", AT).purgeAfter).toEqual(new Date("2026-11-18T10:00:00.000Z"));
    expect(scheduleFor("close_account", AT).purgeAfter).toBeNull();
    expect(PURGE_DAYS).toBe(90);
  });
});

describe("canCancel", () => {
  it("allows cancelling only while pending", () => {
    expect(canCancel("pending")).toBe(true);
    for (const status of ["cancelled", "executed", "purged"] as const) {
      expect(canCancel(status)).toBe(false);
    }
  });
});

describe("isDue", () => {
  it("is false before the boundary, true at and after it", () => {
    const at = new Date("2026-08-27T10:00:00.000Z");
    expect(isDue(at, new Date("2026-08-27T09:59:59.999Z"))).toBe(false);
    expect(isDue(at, at)).toBe(true);
    expect(isDue(at, new Date("2026-08-27T10:00:00.001Z"))).toBe(true);
  });
});
