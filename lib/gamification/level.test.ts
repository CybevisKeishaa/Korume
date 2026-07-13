import { describe, expect, it } from "vitest";
import { levelForXp, thresholdForLevel } from "./level";

describe("thresholdForLevel — triangular curve 100·L·(L−1)/2", () => {
  it("matches the documented sequence", () => {
    expect(thresholdForLevel(1)).toBe(0);
    expect(thresholdForLevel(2)).toBe(100);
    expect(thresholdForLevel(3)).toBe(300);
    expect(thresholdForLevel(4)).toBe(600);
    expect(thresholdForLevel(5)).toBe(1000);
  });
});

describe("levelForXp — boundaries", () => {
  it("xp=0 is level 1, floor 0, next 100, progress 0", () => {
    const r = levelForXp(0);
    expect(r.level).toBe(1);
    expect(r.levelFloorXp).toBe(0);
    expect(r.nextLevelXp).toBe(100);
    expect(r.progressRatio).toBe(0);
  });

  it("xp=99 is still level 1, just under the next threshold", () => {
    const r = levelForXp(99);
    expect(r.level).toBe(1);
    expect(r.levelFloorXp).toBe(0);
    expect(r.nextLevelXp).toBe(100);
    expect(r.progressRatio).toBeCloseTo(0.99, 5);
  });

  it("xp=100 rolls over to level 2 exactly at the threshold", () => {
    const r = levelForXp(100);
    expect(r.level).toBe(2);
    expect(r.levelFloorXp).toBe(100);
    expect(r.nextLevelXp).toBe(300);
    expect(r.progressRatio).toBe(0);
  });

  it("xp=299 is level 2, just under level 3", () => {
    const r = levelForXp(299);
    expect(r.level).toBe(2);
    expect(r.levelFloorXp).toBe(100);
    expect(r.nextLevelXp).toBe(300);
    expect(r.progressRatio).toBeCloseTo(199 / 200, 5);
  });

  it("xp=300 rolls over to level 3", () => {
    const r = levelForXp(300);
    expect(r.level).toBe(3);
    expect(r.levelFloorXp).toBe(300);
    expect(r.nextLevelXp).toBe(600);
  });

  it("xp=999 is level 4, just under level 5", () => {
    const r = levelForXp(999);
    expect(r.level).toBe(4);
    expect(r.levelFloorXp).toBe(600);
    expect(r.nextLevelXp).toBe(1000);
  });

  it("xp=1000 rolls over to level 5", () => {
    const r = levelForXp(1000);
    expect(r.level).toBe(5);
    expect(r.levelFloorXp).toBe(1000);
    expect(r.nextLevelXp).toBe(1500);
  });

  it("clamps negative xp to 0 (level 1, no progress)", () => {
    const r = levelForXp(-50);
    expect(r.level).toBe(1);
    expect(r.levelFloorXp).toBe(0);
    expect(r.progressRatio).toBe(0);
  });
});
