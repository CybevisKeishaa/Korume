import { describe, expect, it } from "vitest";
import { badgeProgress } from "./badge-progress";

const snapshot = { totalXp: 10, streakCurrent: 3, kanjiLearned: 10, totalOutcomes: 3, outcomeCounts: {}, jlptMockLevelsCompleted: [] };

describe("badgeProgress", () => {
  it("maps reachable unsatisfied criteria", () => {
    expect(badgeProgress({ type: "sessions", count: 5 }, snapshot, { kanji: 45 })).toEqual({ current: 3, target: 5, kind: "count" });
    expect(badgeProgress({ type: "streak", days: 5 }, snapshot, { kanji: 45 })).toEqual({ current: 3, target: 5, kind: "streak" });
  });
  it("skips unsupported, malformed, unreachable, and satisfied criteria", () => {
    expect(badgeProgress({ type: "jlpt_mock", level: "N5" }, snapshot, { kanji: 45 })).toBeNull();
    expect(badgeProgress({ type: "kanji_learned", count: 100 }, snapshot, { kanji: 45 })).toBeNull();
    expect(badgeProgress({ type: "sessions" }, snapshot, { kanji: 45 })).toBeNull();
    expect(badgeProgress({ type: "sessions", count: 3 }, snapshot, { kanji: 45 })).toBeNull();
  });
});
