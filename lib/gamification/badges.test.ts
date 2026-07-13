import { describe, expect, it } from "vitest";
import { evaluateBadges } from "./badges";
import type { BadgeSnapshot } from "./types";

const BASE_SNAPSHOT: BadgeSnapshot = {
  totalXp: 0,
  streakCurrent: 0,
  kanjiLearned: 0,
  totalOutcomes: 0,
  outcomeCounts: {},
  jlptMockLevelsCompleted: [],
};

describe("evaluateBadges — each criteria type", () => {
  it("sessions: unlocks when totalOutcomes >= count", () => {
    const badges = [{ id: "b1", name: "First Steps", criteria: { type: "sessions", count: 5 } }];
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, totalOutcomes: 4 })).toEqual([]);
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, totalOutcomes: 5 })).toEqual(["b1"]);
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, totalOutcomes: 6 })).toEqual(["b1"]);
  });

  it("streak: unlocks when streakCurrent >= days", () => {
    const badges = [{ id: "b2", name: "Week Warrior", criteria: { type: "streak", days: 7 } }];
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, streakCurrent: 6 })).toEqual([]);
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, streakCurrent: 7 })).toEqual(["b2"]);
  });

  it("kanji_learned: unlocks when kanjiLearned >= count", () => {
    const badges = [{ id: "b3", name: "Kanji 100", criteria: { type: "kanji_learned", count: 100 } }];
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, kanjiLearned: 99 })).toEqual([]);
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, kanjiLearned: 100 })).toEqual(["b3"]);
  });

  it("xp: unlocks when totalXp >= total", () => {
    const badges = [{ id: "b4", name: "XP 1000", criteria: { type: "xp", total: 1000 } }];
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, totalXp: 999 })).toEqual([]);
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, totalXp: 1000 })).toEqual(["b4"]);
  });

  it("outcome_count: unlocks when outcomeCounts[source] >= count", () => {
    const badges = [
      { id: "b5", name: "Shadow 50", criteria: { type: "outcome_count", source: "shadowing", count: 50 } },
    ];
    expect(
      evaluateBadges(badges, { ...BASE_SNAPSHOT, outcomeCounts: { shadowing: 49 } }),
    ).toEqual([]);
    expect(
      evaluateBadges(badges, { ...BASE_SNAPSHOT, outcomeCounts: { shadowing: 50 } }),
    ).toEqual(["b5"]);
    // Missing key in outcomeCounts entirely -> treated as 0, not satisfied.
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, outcomeCounts: {} })).toEqual([]);
  });

  it("jlpt_mock: unlocks when level is in jlptMockLevelsCompleted", () => {
    const badges = [{ id: "b6", name: "N4 Mock", criteria: { type: "jlpt_mock", level: "N4" } }];
    expect(
      evaluateBadges(badges, { ...BASE_SNAPSHOT, jlptMockLevelsCompleted: ["N5"] }),
    ).toEqual([]);
    expect(
      evaluateBadges(badges, { ...BASE_SNAPSHOT, jlptMockLevelsCompleted: ["N5", "N4"] }),
    ).toEqual(["b6"]);
  });
});

describe("evaluateBadges — multiple badges and ordering", () => {
  it("returns the ids of every satisfied badge, in input order", () => {
    const badges = [
      { id: "a", name: "A", criteria: { type: "xp", total: 100 } },
      { id: "b", name: "B", criteria: { type: "xp", total: 99999 } },
      { id: "c", name: "C", criteria: { type: "streak", days: 1 } },
    ];
    const snapshot: BadgeSnapshot = { ...BASE_SNAPSHOT, totalXp: 500, streakCurrent: 1 };
    expect(evaluateBadges(badges, snapshot)).toEqual(["a", "c"]);
  });
});

describe("evaluateBadges — malformed / forward-incompatible criteria are skipped, not thrown", () => {
  it("skips a badge with an unrecognized type", () => {
    const badges = [{ id: "future", name: "Future Badge", criteria: { type: "seasonal_event", eventId: "sakura-2027" } }];
    expect(() => evaluateBadges(badges, BASE_SNAPSHOT)).not.toThrow();
    expect(evaluateBadges(badges, BASE_SNAPSHOT)).toEqual([]);
  });

  it("skips a badge whose criteria is missing required fields", () => {
    const badges = [{ id: "broken", name: "Broken", criteria: { type: "streak" } }];
    expect(() => evaluateBadges(badges, { ...BASE_SNAPSHOT, streakCurrent: 100 })).not.toThrow();
    expect(evaluateBadges(badges, { ...BASE_SNAPSHOT, streakCurrent: 100 })).toEqual([]);
  });

  it("skips a badge whose criteria is null, a string, or otherwise not an object", () => {
    const badges = [
      { id: "n1", name: "N1", criteria: null },
      { id: "n2", name: "N2", criteria: "not-an-object" },
      { id: "n3", name: "N3", criteria: 42 },
    ];
    expect(evaluateBadges(badges, BASE_SNAPSHOT)).toEqual([]);
  });

  it("still evaluates well-formed badges alongside malformed ones in the same call", () => {
    const badges = [
      { id: "ok", name: "OK", criteria: { type: "xp", total: 0 } },
      { id: "bad", name: "Bad", criteria: { type: "not_a_real_type" } },
    ];
    expect(evaluateBadges(badges, BASE_SNAPSHOT)).toEqual(["ok"]);
  });
});
