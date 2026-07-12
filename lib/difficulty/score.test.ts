import { describe, expect, it } from "vitest";
import { contentLemmas, scoreComprehension, TOO_HARD_MAX, IDEAL_MAX } from "./score";
import type { Token } from "@/lib/japanese/types";

function token(surface: string, pos: string, base = surface): Token {
  return { surface, reading: null, base, pos };
}

describe("scoreComprehension — empty input", () => {
  it("returns insufficient-data with all-zero counts for an empty transcript", () => {
    const r = scoreComprehension([], new Set());
    expect(r).toEqual({ totalWords: 0, knownWords: 0, knownRatio: 0, band: "insufficient-data" });
  });
});

describe("scoreComprehension — extremes", () => {
  it("bands an all-known transcript as too-easy", () => {
    const lemmas = ["猫", "犬", "食べる", "早い"];
    const known = new Set(lemmas);
    const r = scoreComprehension(lemmas, known);
    expect(r.totalWords).toBe(4);
    expect(r.knownWords).toBe(4);
    expect(r.knownRatio).toBe(1);
    expect(r.band).toBe("too-easy");
  });

  it("bands a transcript with no known words as too-hard", () => {
    const lemmas = ["猫", "犬", "食べる", "早い"];
    const r = scoreComprehension(lemmas, new Set());
    expect(r.totalWords).toBe(4);
    expect(r.knownWords).toBe(0);
    expect(r.knownRatio).toBe(0);
    expect(r.band).toBe("too-hard");
  });
});

describe("scoreComprehension — band boundaries", () => {
  // 100 occurrences so each known word moves the ratio by exactly 0.01.
  function lemmasWithRatio(knownCount: number, total = 100): { lemmas: string[]; known: Set<string> } {
    const lemmas: string[] = [];
    for (let i = 0; i < total; i++) lemmas.push(i < knownCount ? "known" : `unknown-${i}`);
    return { lemmas, known: new Set(["known"]) };
  }

  it("0.79 known ratio is too-hard", () => {
    const { lemmas, known } = lemmasWithRatio(79);
    const r = scoreComprehension(lemmas, known);
    expect(r.knownRatio).toBeCloseTo(0.79, 5);
    expect(r.band).toBe("too-hard");
  });

  it("0.80 known ratio is ideal (lower boundary, inclusive)", () => {
    const { lemmas, known } = lemmasWithRatio(80);
    const r = scoreComprehension(lemmas, known);
    expect(r.knownRatio).toBeCloseTo(0.8, 5);
    expect(r.band).toBe("ideal");
  });

  it("0.95 known ratio is ideal (upper boundary, inclusive)", () => {
    const { lemmas, known } = lemmasWithRatio(95);
    const r = scoreComprehension(lemmas, known);
    expect(r.knownRatio).toBeCloseTo(0.95, 5);
    expect(r.band).toBe("ideal");
  });

  it("0.96 known ratio is too-easy", () => {
    const { lemmas, known } = lemmasWithRatio(96);
    const r = scoreComprehension(lemmas, known);
    expect(r.knownRatio).toBeCloseTo(0.96, 5);
    expect(r.band).toBe("too-easy");
  });

  it("exposes the boundary constants used above", () => {
    expect(TOO_HARD_MAX).toBe(0.8);
    expect(IDEAL_MAX).toBe(0.95);
  });
});

describe("scoreComprehension — determinism", () => {
  it("is deterministic across repeated calls with the same input", () => {
    const lemmas = ["猫", "犬", "食べる", "走る"];
    const known = new Set(["猫", "走る"]);
    const a = scoreComprehension(lemmas, known);
    const b = scoreComprehension(lemmas, known);
    expect(a).toEqual(b);
  });

  it("counts occurrences, not distinct lemmas", () => {
    const lemmas = ["猫", "猫", "猫", "犬"];
    const r = scoreComprehension(lemmas, new Set(["猫"]));
    expect(r.totalWords).toBe(4);
    expect(r.knownWords).toBe(3);
    expect(r.knownRatio).toBe(0.75);
  });
});

describe("contentLemmas", () => {
  it("keeps noun/verb/adjective/adverb base forms", () => {
    const tokens: Token[] = [
      token("猫", "名詞"),
      token("走った", "動詞", "走る"),
      token("速い", "形容詞"),
      token("とても", "副詞"),
    ];
    expect(contentLemmas(tokens)).toEqual(["猫", "走る", "速い", "とても"]);
  });

  it("drops particles, auxiliaries, and symbols", () => {
    const tokens: Token[] = [
      token("猫", "名詞"),
      token("は", "助詞"),
      token("かわいい", "形容詞"),
      token("です", "助動詞"),
      token("。", "記号"),
    ];
    expect(contentLemmas(tokens)).toEqual(["猫", "かわいい"]);
  });

  it("returns an empty array for an all-function-word / empty sentence", () => {
    const tokens: Token[] = [token("は", "助詞"), token("。", "記号")];
    expect(contentLemmas(tokens)).toEqual([]);
    expect(contentLemmas([])).toEqual([]);
  });

  it("drops tokens with a blank base form", () => {
    const tokens: Token[] = [token("猫", "名詞"), token("", "名詞", "")];
    expect(contentLemmas(tokens)).toEqual(["猫"]);
  });
});
