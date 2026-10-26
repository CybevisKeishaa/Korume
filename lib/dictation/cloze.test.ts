import { describe, expect, it } from "vitest";
import { tokenize } from "@/lib/japanese/tokenizer";
import type { Token } from "@/lib/japanese/types";
import { clozeCandidates, scoreCloze, selectBlanks, type ClozeBlank } from "./cloze";

const surfaces = async (text: string, idx: number[]) => {
  const t = await tokenize(text);
  return idx.map((i) => t[i]!.surface);
};
const cand = async (text: string) => surfaces(text, clozeCandidates(await tokenize(text)));

describe("clozeCandidates", () => {
  it("never takes an inflected verb stem", async () => {
    expect(await cand("泣いて帰った")).not.toContain("泣い");
  });
  it("takes a noun before する, not the auxiliaries", async () => {
    const c = await cand("勉強して");
    expect(c).toContain("勉強");
    expect(c).not.toContain("し");
    expect(c).not.toContain("て");
  });
  it("takes a dictionary-form verb", async () => {
    expect(await cand("食べる")).toContain("食べる");
  });
  it("skips numerals, pronouns, dependent nouns", async () => {
    // kuromoji reads 三つ as ONE 名詞/一般 token, so the brief's 三つ cannot be excluded by the §3.4 rule; 三 alone is 数.
    expect(await cand("三")).toEqual([]);
    expect(await cand("それ")).toEqual([]);
    expect(await cand("こと")).toEqual([]);
  });
  it("skips Latin tokens but takes the verb", async () => {
    const c = await cand("ABCを買う");
    expect(c).not.toContain("ABC");
    expect(c).toContain("買う");
  });
});

describe("selectBlanks", () => {
  const pick = async (text: string, known = new Set<string>(), max?: number) => {
    const t = await tokenize(text);
    return surfaces(text, selectBlanks(t, known, max));
  };
  it("caps at 3, ascending", async () => {
    const text = "学校で英語と数学と歴史と地理を勉強する";
    const t = await tokenize(text);
    expect(clozeCandidates(t).length).toBeGreaterThanOrEqual(5);
    const idx = selectBlanks(t, new Set());
    expect(idx).toHaveLength(3);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });
  it("never picks two adjacent tokens", async () => {
    const t = await tokenize("日本語勉強");
    const c = clozeCandidates(t);
    const idx = selectBlanks(t, new Set());
    for (let i = 1; i < idx.length; i++) expect(idx[i]! - idx[i - 1]!).toBeGreaterThan(1);
    expect(c.length === 0 || idx.length >= 1).toBe(true);
  });
  it("keeps the preferred of two adjacent candidates", () => {
    const mk = (surface: string): Token => ({ surface, reading: surface, base: surface, pos: "名詞", posDetail1: "一般" });
    const t = [mk("日本"), mk("経済新聞")];
    expect(selectBlanks(t, new Set())).toEqual([1]);
  });
  it("puts a known word last", () => {
    const mk = (surface: string, pos = "名詞"): Token => ({ surface, reading: surface, base: surface, pos, posDetail1: null });
    const t = [mk("英語"), mk("の", "助詞"), mk("本"), mk("と", "助詞"), mk("先生")];
    expect(selectBlanks(t, new Set(["英語"]), 2)).toEqual([2, 4]);
  });
  it("returns [] with no candidate", async () => {
    expect(await pick("それ")).toEqual([]);
  });
});

describe("scoreCloze", () => {
  const b: ClozeBlank = { token: 0, surface: "勉強", reading: "べんきょう" };
  it("accepts surface or reading", () => {
    expect(scoreCloze([b], ["勉強"], [[]]).score).toBe(100);
    expect(scoreCloze([b], ["べんきょう"], [[]]).score).toBe(100);
  });
  it("rejects a partial reading", () => {
    expect(scoreCloze([b], ["べんきょ"], [[]]).score).toBe(0);
  });
  it("discounts hinted graphemes", () => {
    const r = scoreCloze([b], ["べんきょう"], [[0]]);
    expect(r.score).toBe(80);
    expect(r.blanks[0]).toEqual({ correct: true, hinted: 1 });
  });
  it("requires the reading once hinted", () => {
    expect(scoreCloze([b], ["勉強"], [[0]]).score).toBe(0);
  });
  it("scores 0 when all hinted", () => {
    expect(scoreCloze([b], ["べんきょう"], [[0, 1, 2, 3, 4]]).score).toBe(0);
  });
  it("averages blanks and excludes hinted from slots", () => {
    const r = scoreCloze([b, { ...b, token: 2 }], ["勉強", "x"], [[], []]);
    expect(r.score).toBe(50);
    expect(r.metrics.slots).toEqual({ correct: 1, total: 2 });
    const h = scoreCloze([b], ["べんきょう"], [[0]]);
    expect(h.metrics.slots).toEqual({ correct: 0, total: 1 });
  });
});
