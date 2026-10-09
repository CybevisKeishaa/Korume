import { describe, expect, it } from "vitest";
import { buildActivityGrid } from "./activity";

describe("buildActivityGrid", () => {
  it("returns 56 consecutive cells oldest first with states and threshold levels", () => {
    const grid = buildActivityGrid({
      today: "2026-10-08", firstTrackedDate: "2026-09-01", scheduleDays: [4],
      counts: new Map([["2026-10-08", 0], ["2026-10-07", 7], ["2026-10-06", 1], ["2026-10-05", 4], ["2026-10-04", 5], ["2026-10-03", 14], ["2026-10-02", 15], ["2026-10-01", 29], ["2026-09-30", 30]]),
    });
    expect(grid).toHaveLength(56);
    expect(grid[0]?.date).toBe("2026-08-14");
    expect(grid.at(-1)).toMatchObject({ date: "2026-10-08", state: "empty", level: 0 });
    expect(grid.find((cell) => cell.date === "2026-08-31")).toMatchObject({ state: "unavailable", level: 0 });
    expect(grid.find((cell) => cell.date === "2026-09-29")).toMatchObject({ state: "rest", level: 0 });
    expect(grid.find((cell) => cell.date === "2026-10-07")).toMatchObject({ state: "active", level: 2, count: 7 });
    expect(grid.filter((cell) => ["2026-10-06", "2026-10-05", "2026-10-04", "2026-10-03", "2026-10-02", "2026-10-01", "2026-09-30"].includes(cell.date)).map((cell) => cell.level)).toEqual([4, 3, 3, 2, 2, 1, 1]);
  });

  it("keeps 56 distinct consecutive local dates across a Europe/Berlin DST week", () => {
    const grid = buildActivityGrid({ today: "2026-03-29", firstTrackedDate: "2026-02-01", scheduleDays: [], counts: new Map() });
    expect(new Set(grid.map((cell) => cell.date))).toHaveLength(56);
    expect(grid.at(-1)?.date).toBe("2026-03-29");
  });
});
