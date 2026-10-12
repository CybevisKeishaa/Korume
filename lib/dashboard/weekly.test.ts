import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/time/study-day";
import { weeklyBars, weeklyDelta, weeklyWindows } from "./weekly";

describe("weekly dashboard facts", () => {
  it("creates ten adjacent seven-day windows", () => {
    const windows = weeklyWindows("2026-10-08");
    expect(windows).toHaveLength(10);
    expect(windows[0]).toEqual({ index: 0, from: "2026-10-02", to: "2026-10-08" });
    expect(windows[1]).toEqual({ index: 1, from: "2026-09-25", to: "2026-10-01" });
    expect(windows.slice(1).every((window, index) => {
      const newer = windows[index];
      return newer !== undefined && window.to === addDays(newer.from, -1);
    })).toBe(true);
  });
  it("marks only wholly pre-instrumentation windows unavailable and requires three attempts for deltas", () => {
    const windows = weeklyWindows("2026-10-08").slice(0, 2);
    expect(weeklyBars(windows, [], null)).toEqual([{ index: 0, unavailable: true }, { index: 1, unavailable: true }]);
    expect(weeklyBars(windows, [], "2026-10-03")).toEqual([{ index: 0, seconds: 0 }, { index: 1, unavailable: true }]);
    expect(weeklyDelta([{ skill: "listening", window: 0, attempts: 3, mean: 80 }, { skill: "listening", window: 1, attempts: 2, mean: 60 }], "listening")).toBeNull();
    expect(weeklyDelta([{ skill: "listening", window: 0, attempts: 3, mean: 80.4 }, { skill: "listening", window: 1, attempts: 3, mean: 60.1 }], "listening")).toBe(20);
  });
});
