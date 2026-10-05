import { describe, expect, it } from "vitest";
import type { LessonAnalysisView } from "../analysis/view";
import type { SummaryNavigation } from "../navigation";
import { projectEvidence, type ReflectionEvidence } from "./evidence";
import { buildReflectionInput } from "./prompt";

const evidence: ReflectionEvidence = projectEvidence({
  status: {
    shadowing: { kind: "in_progress", percent: 43 },
    pronunciation: { kind: "scored", score: 57 },
    listening: { kind: "scored", score: 83 },
    retention: { kind: "not_enough_data" },
  },
  savedKnowledge: { vocabulary: 4, expressions: 0, grammar: 0, retention: { kind: "not_enough_data" } },
  reviewTargets: [{ lineId: "line-a", lineText: "注文をお願いします", reasons: ["pronunciation"], focusSpan: null }],
  bestLine: { lineId: "line-b", lineText: "ありがとうございました" },
});
const SOURCE = { lineId: "line-a", textJp: "注文をお願いします", startTime: 0, endTime: 2 };
const view: LessonAnalysisView = {
  overview: "Ordering coffee at a café.",
  words: [{ entSeq: 1, surface: "注文", written: "注文", reading: "ちゅうもん", meaning: "order", meaningLocale: "en", meaningSource: "jmdict", posKey: "noun", jlpt: "N3", common: true, whyItMatters: "w", usageNote: "u", source: SOURCE }],
  expressions: [{ expression: "お願いします", commonness: "very_common", meaningUse: "m", nuance: "n", source: SOURCE }],
  grammar: [{ grammarId: "g", title: "〜をお願いします", jlpt: "N5", meaningShort: "please", explanation: "e", tryIt: "t", span: "お願いします", source: SOURCE }],
  culture: [],
};

describe("buildReflectionInput", () => {
  it("hands the model qualities, a yes/no, the named lines and the lesson points", () => {
    const { user, lines } = buildReflectionInput(evidence, view, "Ep.729 At the café", "en");
    expect(user).toContain("<practice>shadowing: practiced\npronunciation: needs_work\nlistening: practiced\nretention: not_started</practice>");
    expect(user).toContain("<saved>yes</saved>");
    expect(user).toContain("R1 (said well): ありがとうございました");
    expect(user).toContain("R2 (worth another pass, pronunciation): 注文をお願いします");
    expect(user).toContain("<lesson_points>注文\nお願いします\n〜をお願いします</lesson_points>");
    expect(user).toContain("<lesson_overview>Ordering coffee at a café.</lesson_overview>");
    expect([...lines.entries()]).toEqual([
      ["R1", { id: "line-b", textJp: "ありがとうございました" }],
      ["R2", { id: "line-a", textJp: "注文をお願いします" }],
    ]);
  });

  it("carries no score, count or memory into the user turn", () => {
    const { user } = buildReflectionInput(evidence, view, "Ep.729 At the café", "en");
    const practice = user.match(/<practice>[\s\S]*<\/practice>/)?.[0] ?? "";
    const saved = user.match(/<saved>[\s\S]*<\/saved>/)?.[0] ?? "";
    expect(practice + saved).not.toMatch(/[0-9]/);
    for (const value of ["57", "83", "43", ">4<", " 4 "]) expect(user).not.toContain(value);
    expect(user.toLowerCase()).not.toMatch(/companion|memory/);
  });

  it("states the reflection contract in the instruction", () => {
    const instruction = buildReflectionInput(evidence, view, "t", "vi").system[1]?.text ?? "";
    expect(instruction).toContain("two or three");
    expect(instruction).toContain("Do not ask the learner anything");
    expect(instruction).toContain("Never mention numbers, counts, scores or percentages");
    expect(instruction).toContain("Never mention other lessons, earlier days");
    expect(instruction).toContain("Never quote Japanese inside text");
    expect(instruction).toContain("highlight_line_id");
  });

  it("accepts only reflection evidence at the type level (proved by tsc, never executed)", () => {
    const typeOnly = () => {
      // @ts-expect-error — the reflection never sees navigation: an extra key is a compile error.
      buildReflectionInput({ ...evidence, nextLesson: null } satisfies ReflectionEvidence, view, "t", "en");
      const navigation: SummaryNavigation = { nextLesson: null, replayHref: "/x", resumeHref: "/x" };
      // @ts-expect-error — navigation is not evidence.
      buildReflectionInput(navigation, view, "t", "en");
    };
    expect(typeof typeOnly).toBe("function");
  });
});
