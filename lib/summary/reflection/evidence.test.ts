import { describe, expect, it } from "vitest";
import type { LessonSnapshot } from "../snapshot";
import { evidenceFingerprint, isEmptyEvidence, projectEvidence } from "./evidence";

function snapshot(overrides: Partial<LessonSnapshot> = {}): LessonSnapshot {
  return {
    status: {
      shadowing: { kind: "in_progress", percent: 43 },
      pronunciation: { kind: "scored", score: 57 },
      listening: { kind: "scored", score: 83 },
      retention: { kind: "scored", score: 91 },
    },
    savedKnowledge: { vocabulary: 4, expressions: 2, grammar: 1, retention: { kind: "count", value: 3 } },
    reviewTargets: [
      { lineId: "line-a", lineText: "雨です", reasons: ["pronunciation", "grammar"], focusSpan: "雨" },
      { lineId: "line-b", lineText: "晴れです", reasons: ["dictation"], focusSpan: null },
      { lineId: "line-c", lineText: "曇りです", reasons: ["difficult"], focusSpan: null },
      { lineId: "line-d", lineText: "雪です", reasons: ["pitch"], focusSpan: null },
    ],
    bestLine: { lineId: "line-e", lineText: "ありがとう" },
    ...overrides,
  };
}

const NOTHING: Partial<LessonSnapshot> = {
  status: {
    shadowing: { kind: "not_started" }, pronunciation: { kind: "not_started" },
    listening: { kind: "not_started" }, retention: { kind: "not_enough_data" },
  },
  savedKnowledge: { vocabulary: 0, expressions: 0, grammar: 0, retention: { kind: "not_enough_data" } },
  reviewTargets: [],
  bestLine: null,
};

describe("projectEvidence", () => {
  it("maps every mode through the one score → state adapter and keeps three targets by their first reason", () => {
    expect(projectEvidence(snapshot())).toEqual({
      modes: { shadowing: "practiced", pronunciation: "needs_work", listening: "practiced", retention: "strong" },
      savedAnything: true,
      targets: [
        { lineId: "line-a", lineText: "雨です", reason: "pronunciation" },
        { lineId: "line-b", lineText: "晴れです", reason: "dictation" },
        { lineId: "line-c", lineText: "曇りです", reason: "difficult" },
      ],
      bestLine: { lineId: "line-e", lineText: "ありがとう" },
    });
  });

  it("lets no number through to the AI", () => {
    expect(JSON.stringify(projectEvidence(snapshot()))).not.toMatch(/[0-9]/);
  });
});

describe("isEmptyEvidence", () => {
  it("is true only when nothing at all happened", () => {
    expect(isEmptyEvidence(projectEvidence(snapshot(NOTHING)))).toBe(true);
    expect(isEmptyEvidence(projectEvidence(snapshot({ ...NOTHING, bestLine: { lineId: "x", lineText: "y" } })))).toBe(false);
    expect(isEmptyEvidence(projectEvidence(snapshot({
      ...NOTHING, savedKnowledge: { vocabulary: 1, expressions: 0, grammar: 0, retention: { kind: "not_enough_data" } },
    })))).toBe(false);
    expect(isEmptyEvidence(projectEvidence(snapshot({
      ...NOTHING, status: { ...NOTHING.status!, shadowing: { kind: "in_progress", percent: 5 } },
    })))).toBe(false);
  });
});

describe("evidenceFingerprint", () => {
  it("moves with a quality band, not with a score inside the band", () => {
    const base = evidenceFingerprint(projectEvidence(snapshot()));
    expect(evidenceFingerprint(projectEvidence(snapshot()))).toBe(base);
    const status = snapshot().status;
    const sameBand = snapshot({ status: { ...status, listening: { kind: "scored", score: 81 } } });
    expect(evidenceFingerprint(projectEvidence(sameBand))).toBe(base);
    const otherBand = snapshot({ status: { ...status, listening: { kind: "scored", score: 96 } } });
    expect(evidenceFingerprint(projectEvidence(otherBand))).not.toBe(base);
  });
});
