import { describe, expect, it } from "vitest";
import { mondayStartUtc } from "./week";

// Anchor fact used throughout: 2024-01-01 was a Monday.
describe("mondayStartUtc", () => {
  it("returns VN-local Monday 00:00, expressed as its UTC instant, for a mid-week Wednesday", () => {
    // 2024-01-03T04:00:00Z + 7h = 2024-01-03T11:00 VN-local (Wednesday).
    const now = new Date("2024-01-03T04:00:00.000Z");
    expect(mondayStartUtc(now).toISOString()).toBe("2023-12-31T17:00:00.000Z");
  });

  it("is stable across the whole week (Tuesday just after the boundary lands on the same Monday)", () => {
    // 2024-01-01T17:00:00Z + 7h = 2024-01-02T00:00 VN-local (Tuesday).
    const now = new Date("2024-01-01T17:00:00.000Z");
    expect(mondayStartUtc(now).toISOString()).toBe("2023-12-31T17:00:00.000Z");
  });

  it("is boundary-inclusive: exactly VN-local Monday 00:00:00 returns itself", () => {
    const now = new Date("2023-12-31T17:00:00.000Z"); // == VN-local 2024-01-01T00:00:00
    expect(mondayStartUtc(now).toISOString()).toBe("2023-12-31T17:00:00.000Z");
  });

  it("one millisecond before the boundary falls back to the previous week's Monday", () => {
    const now = new Date("2023-12-31T16:59:59.999Z"); // == VN-local 2023-12-31T23:59:59.999 (Sunday)
    expect(mondayStartUtc(now).toISOString()).toBe("2023-12-24T17:00:00.000Z");
  });

  it("handles a VN-local Sunday correctly (walks back 6 days to the prior Monday)", () => {
    // 2024-01-07T10:00:00Z + 7h = 2024-01-07T17:00 VN-local (Sunday).
    const now = new Date("2024-01-07T10:00:00.000Z");
    expect(mondayStartUtc(now).toISOString()).toBe("2023-12-31T17:00:00.000Z");
  });
});
