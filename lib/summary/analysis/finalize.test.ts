import { describe, expect, it } from "vitest";
import { FinalizeError } from "@/lib/knowledge/leased";
import { finalizeAnalysis } from "./finalize";
import type { AnalysisInput } from "./input";

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";
const INPUT: AnalysisInput = {
  lines: [
    { shortId: "L1", id: L1, textJp: "𠮷野家で注文します？" },
    { shortId: "L2", id: L2, textJp: "店員さんに聞きます。" },
  ],
  vocabulary: [
    { shortId: "v1", entSeq: 100, surface: "注文", lineId: L1 },
    { shortId: "v2", entSeq: 200, surface: "店員", lineId: L2 },
  ],
  grammar: [{ shortId: "g1", grammarId: "grammar-a", lineId: L2, span: "ます" }],
};

const word = (candidate_id: string, extra: Record<string, unknown> = {}) =>
  ({ candidate_id, why_it_matters: "useful", usage_note: "used here", ...extra });
const expression = (line: string, span: string, extra: Record<string, unknown> = {}) =>
  ({ line, span, meaning_use: "meaning", nuance: "nuance", commonness: "common", ...extra });
const grammarItem = (candidate_id: string) =>
  ({ candidate_id, meaning_short: "polite", explanation: "explains", try_it: "行きます。" });
const parsed = (overrides: Record<string, unknown> = {}) =>
  ({ overview: "  A lesson.  ", words: [word("v1")], expressions: [], grammar: [grammarItem("g1")], culture: [], ...overrides });

describe("finalizeAnalysis", () => {
  it("drops a word item carrying an extra field and keeps the strict one, grounded by id", () => {
    const result = finalizeAnalysis(parsed({ words: [word("v2", { reading: "てんいん" }), word("v1")] }), INPUT);
    expect(result.words).toEqual([
      { entSeq: 100, surface: "注文", sourceLineId: L1, whyItMatters: "useful", usageNote: "used here" },
    ]);
  });

  it("drops unknown candidate ids and unknown line ids", () => {
    const result = finalizeAnalysis(parsed({
      words: [word("v9"), word("v1")],
      expressions: [expression("L9", "注文")],
      culture: [{ line: "L9", title: "t", body: "b" }],
    }), INPUT);
    expect(result.words.map((item) => item.entSeq)).toEqual([100]);
    expect(result.expressions).toEqual([]);
    expect(result.culture).toEqual([]);
  });

  it("checks expression spans as NFKC substrings, never offsets (Review Focus 2)", () => {
    const result = finalizeAnalysis(parsed({
      expressions: [expression("L1", "注文します?"), expression("L1", "注文しました"), expression("L1", "   ")],
    }), INPUT);
    expect(result.expressions).toEqual([
      { sourceLineId: L1, span: "注文します?", meaningUse: "meaning", nuance: "nuance", commonness: "common" },
    ]);
  });

  it("drops an unknown commonness value", () => {
    expect(finalizeAnalysis(parsed({ expressions: [expression("L2", "聞きます", { commonness: "rare" })] }), INPUT).expressions).toEqual([]);
  });

  it("keeps one word per candidate and one expression per line + span", () => {
    const result = finalizeAnalysis(parsed({
      words: [word("v1"), word("v1")],
      expressions: [expression("L2", "聞きます"), expression("L2", "聞きます")],
    }), INPUT);
    expect(result.words).toHaveLength(1);
    expect(result.expressions).toHaveLength(1);
  });

  it("caps words at 6, in model order", () => {
    const vocabulary = Array.from({ length: 9 }, (_, i) => ({ shortId: `v${i + 1}`, entSeq: i + 1, surface: `語${i}`, lineId: L1 }));
    const result = finalizeAnalysis(
      parsed({ words: vocabulary.map((item) => word(item.shortId)) }),
      { ...INPUT, vocabulary },
    );
    expect(result.words.map((item) => item.entSeq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("throws FinalizeError when candidates were offered and no word or grammar item survives", () => {
    expect(() => finalizeAnalysis(parsed({ words: [word("v9")], grammar: [grammarItem("g9")] }), INPUT)).toThrow(FinalizeError);
  });

  it("accepts empty words and grammar when no candidates were offered", () => {
    const result = finalizeAnalysis(parsed({ words: [], grammar: [] }), { ...INPUT, vocabulary: [], grammar: [] });
    expect(result).toMatchObject({ words: [], grammar: [] });
  });

  it("anchors culture notes, caps them at 3, and trims and cuts the overview", () => {
    const culture = Array.from({ length: 5 }, (_, i) => ({ line: "L2", title: `t${i}`, body: "b" }));
    const result = finalizeAnalysis(parsed({ culture, overview: ` ${"あ".repeat(500)} ` }), INPUT);
    expect(result.culture).toHaveLength(3);
    expect(result.culture[0]).toEqual({ sourceLineId: L2, title: "t0", body: "b" });
    expect(result.overview).toBe("あ".repeat(400));
    expect(finalizeAnalysis(parsed(), INPUT).overview).toBe("A lesson.");
  });

  it("stores no request-local short id", () => {
    const result = finalizeAnalysis(parsed({
      expressions: [expression("L2", "聞きます")],
      culture: [{ line: "L1", title: "t", body: "b" }],
    }), INPUT);
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/"candidate_id"|"line"/);
    expect(json).not.toMatch(/"(L|v|g)\d+"/);
    const sourceIds = [...result.words, ...result.expressions, ...result.grammar, ...result.culture].map((item) => item.sourceLineId);
    expect(sourceIds.length).toBeGreaterThan(0);
    expect(sourceIds.every((id) => id === L1 || id === L2)).toBe(true);
  });

  it("skips a null item (a malformed item after .catch(null)) instead of throwing", () => {
    const result = finalizeAnalysis(parsed({ words: [null, word("v1")], expressions: [null], culture: [null] }), INPUT);
    expect(result.words).toHaveLength(1);
  });
});
