import { describe, expect, it } from "vitest";
import type { LessonSnapshot } from "../snapshot";
import { buildReflectionFallback } from "./fallback";

const base: LessonSnapshot = {
  status: {
    shadowing: { kind: "not_started" }, pronunciation: { kind: "not_started" },
    listening: { kind: "not_started" }, retention: { kind: "not_enough_data" },
  },
  savedKnowledge: { vocabulary: 0, expressions: 0, grammar: 0, retention: { kind: "not_enough_data" } },
  reviewTargets: [],
  bestLine: null,
};
const target = { lineId: "t", lineText: "晴れです", reasons: ["dictation" as const], focusSpan: null };

describe("buildReflectionFallback", () => {
  it("prefers the best line, then the first target, then the shadowing state", () => {
    expect(buildReflectionFallback({ ...base, bestLine: { lineId: "b", lineText: "雨です" }, reviewTargets: [target] }))
      .toEqual({ kind: "best_line", line: "雨です" });
    expect(buildReflectionFallback({ ...base, reviewTargets: [target] })).toEqual({ kind: "target", line: "晴れです" });
    expect(buildReflectionFallback({ ...base, status: { ...base.status, shadowing: { kind: "complete" } } }))
      .toEqual({ kind: "state", state: "complete" });
    expect(buildReflectionFallback({ ...base, status: { ...base.status, shadowing: { kind: "in_progress", percent: 20 } } }))
      .toEqual({ kind: "state", state: "in_progress" });
    expect(buildReflectionFallback(base)).toEqual({ kind: "state", state: "not_started" });
  });
});
