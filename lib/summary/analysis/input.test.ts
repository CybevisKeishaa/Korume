import { describe, expect, it } from "vitest";
import type { AnalysisToken, GrammarMatch, StaticLineAnalysis } from "@/lib/analysis/types";
import { analysisFingerprint, buildAnalysisInput, GRAMMAR_CANDIDATE_CAP, VOCABULARY_CANDIDATE_CAP } from "./input";

function token(surface: string, entSeq: number | null, start = 0): AnalysisToken {
  return {
    index: 0, surface, base: surface, reading: null, pos: "名詞", span: { start, end: start + surface.length },
    entries: entSeq === null ? [] : [{ entSeq, headword: surface, reading: "よみ", glossEn: "gloss", jlpt: null }],
    vocabId: null,
  };
}
function grammar(grammarPointId: string, start: number, end: number): GrammarMatch {
  return { grammarPointId, title: grammarPointId, structure: null, explanation: null, examples: [], span: { start, end } };
}
function analysis(lineId: string, tokens: AnalysisToken[], matches: GrammarMatch[] = []): StaticLineAnalysis {
  return { lineId, snapshotId: "snap", tokens, grammar: matches };
}

describe("buildAnalysisInput", () => {
  it("skips whitespace-only lines and numbers the kept lines L1…Ln in order", () => {
    const input = buildAnalysisInput(
      [{ id: "a", textJp: "雨です。" }, { id: "b", textJp: "  　" }, { id: "c", textJp: "晴れです。" }],
      new Map(),
    );
    expect(input.lines).toEqual([
      { shortId: "L1", id: "a", textJp: "雨です。" },
      { shortId: "L2", id: "c", textJp: "晴れです。" },
    ]);
  });

  it("orders vocabulary by frequency then entSeq, with the surface of the first line it occurs in", () => {
    const lines = [{ id: "a", textJp: "注文、店員" }, { id: "b", textJp: "注文した" }];
    const analyses = new Map([
      ["a", analysis("a", [token("注文", 200), token("店員", 100, 3)])],
      ["b", analysis("b", [token("注文", 200), token("した", null, 2)])],
    ]);
    expect(buildAnalysisInput(lines, analyses).vocabulary).toEqual([
      { shortId: "v1", entSeq: 200, surface: "注文", lineId: "a" },
      { shortId: "v2", entSeq: 100, surface: "店員", lineId: "a" },
    ]);
  });

  it("takes the first occurrence of each grammar point, with the span sliced from its line", () => {
    const lines = [{ id: "a", textJp: "食べてもいいです" }, { id: "b", textJp: "飲んでもいいです" }];
    const analyses = new Map([
      ["a", analysis("a", [], [grammar("g-temo", 2, 6)])],
      ["b", analysis("b", [], [grammar("g-temo", 2, 6), grammar("g-desu", 6, 8)])],
    ]);
    expect(buildAnalysisInput(lines, analyses).grammar).toEqual([
      { shortId: "g1", grammarId: "g-temo", lineId: "a", span: "てもいい" },
      { shortId: "g2", grammarId: "g-desu", lineId: "b", span: "です" },
    ]);
  });

  it("caps candidates at 60 / 40 and keeps every line of the largest transcript (2000 lines)", () => {
    const lines = Array.from({ length: 2000 }, (_, i) => ({ id: `line-${i}`, textJp: `文${i}` }));
    const analyses = new Map(lines.map((line, i) => [
      line.id,
      analysis(line.id, [token(`語${i % 200}`, 1000 + (i % 200))], [grammar(`g-${i % 100}`, 0, 1)]),
    ]));
    const input = buildAnalysisInput(lines, analyses);
    expect(input.lines).toHaveLength(2000);
    expect(input.vocabulary).toHaveLength(VOCABULARY_CANDIDATE_CAP);
    expect(input.grammar).toHaveLength(GRAMMAR_CANDIDATE_CAP);
    expect(VOCABULARY_CANDIDATE_CAP).toBe(60);
    expect(GRAMMAR_CANDIDATE_CAP).toBe(40);
  });
});

describe("analysisFingerprint", () => {
  const base = () => buildAnalysisInput(
    [{ id: "a", textJp: "食べてもいいです" }],
    new Map([["a", analysis("a", [token("食べ", 300)], [grammar("g-temo", 2, 5)])]]),
  );

  it("is stable for equal input and ignores request-local short ids", () => {
    const input = base();
    expect(analysisFingerprint(input)).toBe(analysisFingerprint(base()));
    const renumbered = {
      lines: input.lines.map((line) => ({ ...line, shortId: "L99" })),
      vocabulary: input.vocabulary.map((item) => ({ ...item, shortId: "v99" })),
      grammar: input.grammar.map((item) => ({ ...item, shortId: "g99" })),
    };
    expect(analysisFingerprint(renumbered)).toBe(analysisFingerprint(input));
  });

  it("changes when a line text, a candidate surface or a grammar span changes", () => {
    const input = base();
    const before = analysisFingerprint(input);
    expect(analysisFingerprint({ ...input, lines: [{ ...input.lines[0]!, textJp: "飲んでもいいです" }] })).not.toBe(before);
    expect(analysisFingerprint({ ...input, vocabulary: [{ ...input.vocabulary[0]!, surface: "食" }] })).not.toBe(before);
    expect(analysisFingerprint({ ...input, grammar: [{ ...input.grammar[0]!, span: "もい" }] })).not.toBe(before);
  });
});
