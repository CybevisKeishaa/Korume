import { describe, expect, it } from "vitest";
import { buildLessonSnapshot, lessonEvidenceSchema, mistakeSpan, summaryLines, type LessonEvidence, type SummaryLine } from "./snapshot";

const evidence = (overrides: Partial<LessonEvidence> = {}): LessonEvidence => ({
  hasTranscript: true,
  lineCount: 10,
  reachedLine: 0,
  pronunciationMean: null,
  wordBankMean: null,
  typingMean: null,
  completed: false,
  cards: {
    total: 0,
    mastered: 0,
    reviewedAny: false,
    vocabularyRefs: 0,
    expressionRefs: 0,
    knowledgeRemembered: 0,
    knowledgeReviewedAny: false,
  },
  lines: [],
  saved: [],
  ...overrides,
});

const lines = (count: number): SummaryLine[] => Array.from({ length: count }, (_, index) => ({
  id: `line-${index + 1}`,
  index,
  textJp: `文${index + 1}`,
  translation: null,
  startTime: index * 5,
  endTime: index * 5 + 4,
}));

describe("buildLessonSnapshot", () => {
  it("keeps a lesson with no lines in non-scored states without dividing by zero", () => {
    const snapshot = buildLessonSnapshot(evidence({ hasTranscript: false, lineCount: 0 }), [], new Map(), 0);

    expect(snapshot.status).toEqual({
      shadowing: { kind: "not_started" },
      pronunciation: { kind: "not_started" },
      listeningWordBank: { kind: "not_started" },
      listeningTyping: { kind: "not_started" },
      retention: { kind: "not_enough_data" },
    });
    expect(snapshot.reviewTargets).toEqual([]);
    expect(snapshot.bestLine).toBeNull();
  });

  it("derives shadowing as the sentence the learner watched to, never complete (D7)", () => {
    expect(buildLessonSnapshot(evidence({ reachedLine: 0 }), lines(10), new Map(), 0).status.shadowing).toEqual({ kind: "not_started" });
    expect(buildLessonSnapshot(evidence({ lineCount: 0, reachedLine: 0 }), lines(0), new Map(), 0).status.shadowing).toEqual({ kind: "not_started" });
    expect(buildLessonSnapshot(evidence({ lineCount: 194, reachedLine: 51 }), lines(194), new Map(), 0).status.shadowing)
      .toEqual({ kind: "reached", line: 51, total: 194 });
    expect(buildLessonSnapshot(evidence({ reachedLine: 10 }), lines(10), new Map(), 0).status.shadowing).toEqual({ kind: "reached", line: 10, total: 10 });
  });

  it("preserves zero means and rounds non-null pronunciation and dictation means", () => {
    expect(buildLessonSnapshot(evidence({ pronunciationMean: 0 }), lines(1), new Map(), 0).status.pronunciation).toEqual({ kind: "scored", score: 0 });
    expect(buildLessonSnapshot(evidence({ pronunciationMean: 74.5 }), lines(1), new Map(), 0).status.pronunciation).toEqual({ kind: "scored", score: 75 });
  });

  it("keeps Listening per format, never averaged: Typing 72.4 scores 72 while an untouched Word Bank is not started", () => {
    const status = buildLessonSnapshot(evidence({ typingMean: 72.4, wordBankMean: null }), lines(1), new Map(), 0).status;
    expect(status.listeningTyping).toEqual({ kind: "scored", score: 72 });
    expect(status.listeningWordBank).toEqual({ kind: "not_started" });
    const swapped = buildLessonSnapshot(evidence({ typingMean: null, wordBankMean: 88.6 }), lines(1), new Map(), 0).status;
    expect(swapped.listeningWordBank).toEqual({ kind: "scored", score: 89 });
    expect(swapped.listeningTyping).toEqual({ kind: "not_started" });
  });

  it("uses all cards as the retention denominator only after a review", () => {
    expect(buildLessonSnapshot(evidence({ cards: { ...evidence().cards, total: 0 } }), lines(1), new Map(), 0).status.retention).toEqual({ kind: "not_enough_data" });
    expect(buildLessonSnapshot(evidence({ cards: { ...evidence().cards, total: 9, mastered: 2, reviewedAny: false } }), lines(1), new Map(), 0).status.retention).toEqual({ kind: "not_enough_data" });
    expect(buildLessonSnapshot(evidence({ cards: { ...evidence().cards, total: 9, mastered: 2, reviewedAny: true } }), lines(1), new Map(), 0).status.retention).toEqual({ kind: "scored", score: 22 });
  });

  it("reports saved knowledge independently from retention availability", () => {
    const base = { ...evidence().cards, vocabularyRefs: 5, expressionRefs: 2, knowledgeRemembered: 1 };
    expect(buildLessonSnapshot(evidence({ cards: base }), lines(1), new Map(), 3).savedKnowledge).toEqual({
      vocabulary: 5, expressions: 2, grammar: 3, retention: { kind: "not_enough_data" },
    });
    expect(buildLessonSnapshot(evidence({ cards: { ...base, knowledgeReviewedAny: true } }), lines(1), new Map(), 3).savedKnowledge.retention)
      .toEqual({ kind: "count", value: 1 });
  });

  it("prioritizes flagged existing lines by reasons, score, then transcript order", () => {
    const lessonLines: SummaryLine[] = [
      { id: "a", index: 0, textJp: "今日は雨です", translation: null, startTime: 0, endTime: 1 },
      { id: "b", index: 1, textJp: "明日は晴れです", translation: null, startTime: 2, endTime: 3 },
      { id: "c", index: 2, textJp: "注文します", translation: null, startTime: 4, endTime: 5 },
    ];
    const snapshot = buildLessonSnapshot(evidence({
      lines: [
        { lineId: "a", pronunciation: 52, pitch: null, listening: [], difficult: false },
        { lineId: "b", pronunciation: null, pitch: 48, listening: [{ format: "typing", status: "submitted", score: 70, input: "明日は雨です" }], difficult: false },
        { lineId: "c", pronunciation: null, pitch: null, listening: [], difficult: true },
        { lineId: "deleted", pronunciation: 1, pitch: null, listening: [], difficult: false },
      ],
    }), lessonLines, new Map([["a", ["は"]], ["deleted", ["gone"]]]), 0);

    expect(snapshot.reviewTargets).toEqual([
      { lineId: "b", lineText: "明日は晴れです", reasons: ["pitch", "dictation"], focusSpan: "晴れ" },
      { lineId: "a", lineText: "今日は雨です", reasons: ["pronunciation", "grammar"], focusSpan: "は" },
      { lineId: "c", lineText: "注文します", reasons: ["difficult"], focusSpan: null },
    ]);
  });

  it("selects the highest strong pronunciation line", () => {
    const snapshot = buildLessonSnapshot(evidence({ lines: [
      { lineId: "line-1", pronunciation: 80, pitch: null, listening: [], difficult: false },
      { lineId: "line-2", pronunciation: 91, pitch: null, listening: [], difficult: false },
    ] }), lines(2), new Map(), 0);
    expect(snapshot.bestLine).toEqual({ lineId: "line-2", lineText: "文2" });
    expect(buildLessonSnapshot(evidence({ lines: [{ lineId: "line-1", pronunciation: 79, pitch: null, listening: [], difficult: false }] }), lines(1), new Map(), 0).bestLine).toBeNull();
  });
});

describe("buildLessonSnapshot · Listening review (spec §6.2, §8)", () => {
  const one: SummaryLine[] = [{ id: "a", index: 0, textJp: "明日は晴れです", translation: null, startTime: 0, endTime: 1 }];
  const row = (listening: LessonEvidence["lines"][number]["listening"]): LessonEvidence["lines"][number] => (
    { lineId: "a", pronunciation: null, pitch: null, listening, difficult: false }
  );

  it("Typing 95 then Show answer: the average keeps 95 (R1) and the line is in Review as revealed, not as dictation (R2)", () => {
    const snapshot = buildLessonSnapshot(evidence({
      typingMean: 95,
      lines: [row([{ format: "typing", status: "revealed", score: null, input: null }])],
    }), one, new Map(), 0);
    expect(snapshot.status.listeningTyping).toEqual({ kind: "scored", score: 95 });
    expect(snapshot.reviewTargets).toEqual([{ lineId: "a", lineText: "明日は晴れです", reasons: ["revealed"], focusSpan: null }]);
  });

  it("a weak Typing submission is dictation, focused on its first mistake", () => {
    const snapshot = buildLessonSnapshot(evidence({
      lines: [row([{ format: "typing", status: "submitted", score: 70, input: "明日は雨です" }])],
    }), one, new Map([["a", ["です"]]]), 0);
    expect(snapshot.reviewTargets).toEqual([{ lineId: "a", lineText: "明日は晴れです", reasons: ["dictation", "grammar"], focusSpan: "晴れ" }]);
  });

  it("a weak Word Bank submission is dictation, focused on the line's grammar (no typed text to diff)", () => {
    const snapshot = buildLessonSnapshot(evidence({
      lines: [row([{ format: "word_bank", status: "submitted", score: 70, input: "明日は雨です" }])],
    }), one, new Map([["a", ["です"]]]), 0);
    expect(snapshot.reviewTargets).toEqual([{ lineId: "a", lineText: "明日は晴れです", reasons: ["dictation", "grammar"], focusSpan: "です" }]);
  });

  it("names each reason once across both formats, and a strong or legacy unscored attempt adds none", () => {
    const both = buildLessonSnapshot(evidence({
      lines: [row([
        { format: "typing", status: "revealed", score: null, input: null },
        { format: "word_bank", status: "submitted", score: 60, input: null },
      ])],
    }), one, new Map(), 0);
    expect(both.reviewTargets[0]?.reasons).toEqual(["dictation", "revealed"]);
    const quiet = buildLessonSnapshot(evidence({
      lines: [row([
        { format: "typing", status: "unscored", score: null, input: "明日" },
        { format: "word_bank", status: "submitted", score: 80, input: null },
      ])],
    }), one, new Map(), 0);
    expect(quiet.reviewTargets).toEqual([]);
  });

  it("parses the SQL shape: listening [] for an untouched line, and a legacy unscored attempt", () => {
    const parsed = lessonEvidenceSchema.parse({
      ...evidence({ wordBankMean: null, typingMean: "70.5" as unknown as number }),
      lines: [
        { lineId: "a", pronunciation: 52, pitch: null, listening: [], difficult: false },
        { lineId: "b", pronunciation: null, pitch: null, difficult: false,
          listening: [{ format: "typing", status: "unscored", score: null, input: "x" }] },
      ],
    });
    expect(parsed.typingMean).toBe(70.5);
    expect(parsed.lines.map((line) => line.listening.length)).toEqual([0, 1]);
    expect(() => lessonEvidenceSchema.parse({ ...evidence(), dictationMean: 1, wordBankMean: undefined })).toThrow();
  });
});

describe("mistakeSpan", () => {
  it("returns the first missing or wrong run and ignores extras", () => {
    expect(mistakeSpan("今日は雨です", "今日は雪です")).toBe("雨");
    expect(mistakeSpan("今日は雨です", "今日は雨です")).toBeNull();
    expect(mistakeSpan("注文をお願いします", "注文を")).toBe("お願いします");
  });
});

describe("summaryLines", () => {
  const row = (id: string, text: string) => ({
    id, text_jp: text, text_translation: `${id} vi`, start_time: Number(id.slice(1)), end_time: null,
  });

  it("drops blank lines and numbers the rest from 0, so every caller derives the same analysis key", () => {
    expect(summaryLines([row("l1", "一"), row("l2", " 　 "), row("l3", "三")])).toEqual([
      { id: "l1", index: 0, textJp: "一", translation: "l1 vi", startTime: 1, endTime: null },
      { id: "l3", index: 1, textJp: "三", translation: "l3 vi", startTime: 3, endTime: null },
    ]);
  });

  it("returns an empty list for no transcript", () => {
    expect(summaryLines(undefined)).toEqual([]);
  });
});
