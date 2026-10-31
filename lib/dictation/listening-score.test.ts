import { describe, expect, it } from "vitest";
import { displayMap } from "./display";
import { normalizeJa } from "./normalize";
import { chunkUnits, grapheme1Units, grapheme4Units, scoreTyping, scoreWordBank, scoreWordBankLcs, stripPunctuation } from "./listening-score";
import { TYPING_OPTIONAL } from "./listening-score";

const BASE = "注文をお願いします。";
const FIRST = { start: 0, end: 3 };
const SECOND = { start: 3, end: 10 };

describe("scoreWordBank", () => {
  const chunks = ["今日は", "雨です。"];
  it("scores by slot", () => {
    expect(scoreWordBank(chunks, [1, 0], new Set()).score).toBe(0);
    const ok = scoreWordBank(chunks, [0, 1], new Set());
    expect(ok.score).toBe(100);
    expect(ok.metrics).toEqual({ recall: 100, slots: { correct: 2, total: 2 } });
    expect("kanji" in ok.metrics || "grammar" in ok.metrics).toBe(false);
  });
  it("hinted slots do not score", () => {
    const r = scoreWordBank(chunks, [0, 1], new Set([0]));
    expect(r.score).toBe(50);
    expect(r.slots[0]).toEqual({ chunkIndex: 0, correct: true, hinted: true });
    expect(r.metrics.slots).toEqual({ correct: 1, total: 2 });
    expect(scoreWordBank(chunks, [0, 1], new Set([0, 1])).score).toBe(0);
  });
  it("identical texts count as correct in any order", () => {
    expect(scoreWordBank(["はい、", "はい、", "はい。"], [1, 0, 2], new Set()).score).toBe(100);
  });
});

describe("scoreWordBankLcs", () => {
  const correct = (r: ReturnType<typeof scoreWordBankLcs>) => r.slots.map((s) => s.correct);
  it("marks the pieces outside the longest common subsequence", () => {
    const r = scoreWordBankLcs(["A", "B", "C", "D"], [1, 2, 3, 0], 0);
    expect(correct(r)).toEqual([true, true, true, false]);
    expect(r.score).toBe(75);
    expect(r.slots[0]).toEqual({ chunkIndex: 1, correct: true, hinted: false });
    expect(r.metrics).toEqual({ recall: 75, slots: { correct: 3, total: 4 } });
  });
  it("identical texts are interchangeable", () => {
    expect(scoreWordBankLcs(["私", "を", "見", "を", "待つ"], [0, 3, 2, 1, 4], 0).score).toBe(100);
    expect(scoreWordBankLcs(["は", "A", "は"], [2, 1, 0], 0).score).toBe(100);
    expect(scoreWordBankLcs(["です", "A", "です"], [2, 1, 0], 0).score).toBe(100);
  });
  it("hinted slots never score and leave the reference", () => {
    const r = scoreWordBankLcs(["A", "B", "C"], [0, 2, 1], 1);
    expect(r.slots[0]?.hinted).toBe(true);
    expect(r.slots[1]?.hinted).toBe(false);
    expect(r.score).toBe(33.3);
    expect(scoreWordBankLcs(["A", "B"], [0, 1], 2).score).toBe(0);
    const dup = scoreWordBankLcs(["A", "B", "A"], [0, 2, 1], 1);
    expect(correct(dup)).toEqual([false, false, true]);
    expect(dup.score).toBe(33.3);
  });
  it("breaks ties the same way every call", () => {
    const run = () => correct(scoreWordBankLcs(["A", "B"], [1, 0], 0));
    expect(run()).toEqual([false, true]);
    expect(run()).toEqual([false, true]);
  });
});

describe("scoreTyping", () => {
  it("ignores punctuation", () => {
    expect(scoreTyping("今日は雨です。", "今日は雨です", [], []).score).toBe(100);
  });
  it('strips " from the reference and the input', () => {
    expect(scoreTyping('"今日は"雨です。', '今日は"雨です', [], []).score).toBe(100);
    expect(stripPunctuation('"はい"').chars).toEqual(["は", "い"]);
  });
  it("a diff op shows the raw reference character, hinted ops too; extra has none", () => {
    const text = "ｶﾀｶﾅ";
    const r = scoreTyping(normalizeJa(text), "カタカナで", [{ start: 3, end: 4 }], [], displayMap(text));
    expect(r.diff).toEqual([
      { type: "match", expected: "カ", actual: "カ", display: "ｶ" },
      { type: "match", expected: "タ", actual: "タ", display: "ﾀ" },
      { type: "match", expected: "カ", actual: "カ", display: "ｶ" },
      { type: "hinted", expected: "ナ", display: "ﾅ" },
      { type: "extra", actual: "で" },
    ]);
  });
  it("without a map the display is the base character", () => {
    expect(scoreTyping("雨", "", [], []).diff).toEqual([{ type: "missing", expected: "雨", display: "雨" }]);
  });
  it("flags kana for kanji", () => {
    const r = scoreTyping("今日は雨です。", "きょうは雨です", [], []);
    expect(r.score).toBeLessThan(100);
    expect(r.diff.some((d) => d.type === "missing" || d.type === "wrong")).toBe(true);
  });
  it("empty input and empty reference score 0", () => {
    expect(scoreTyping("今日は雨です。", "", [], []).score).toBe(0);
    expect(scoreTyping("。", "あ", [], []).score).toBe(0);
  });
  it("hint at its own position", () => {
    const r = scoreTyping(BASE, "注文を", [SECOND], []);
    expect(r.score).toBe(33.3);
    expect(r.diff.filter((d) => d.type === "hinted")).toHaveLength(6);
    expect(r.diff.some((d) => d.type === "missing")).toBe(false);
  });
  it("hint offset: typed text shifted against the hint", () => {
    expect(scoreTyping(BASE, "お願いします", [FIRST], []).score).toBe(66.7);
  });
  it("hint range after punctuation uses the strip map", () => {
    const r = scoreTyping("はい、注文をお願いします。", "はい注文を", [{ start: 6, end: 13 }], []);
    expect(r.score).toBe(45.5);
    expect(r.diff.filter((d) => d.type === "hinted")).toHaveLength(6);
    expect(r.diff.some((d) => d.type === "missing")).toBe(false);
  });
  it("fully hinted scores 0", () => {
    expect(scoreTyping(BASE, "注文をお願いします", [{ start: 0, end: 10 }], []).score).toBe(0);
  });
  it("kanji metric", () => {
    expect(scoreTyping("今日は雨です。", "今日は雨です", [], []).metrics.kanji).toBe(100);
    expect(scoreTyping("これです。", "これです", [], []).metrics.kanji).toBeUndefined();
  });
  it("grammar metric from ranges", () => {
    const g = scoreTyping("今日は雨です。", "今日は雨", [], [{ start: 4, end: 7 }]);
    expect(g.metrics.grammar).toBe(0);
    expect(scoreTyping("今日は雨です。", "今日は雨です", [], []).metrics.grammar).toBeUndefined();
  });
  it("grammar range after punctuation uses the strip map", () => {
    expect(scoreTyping("今日、雨です。", "今日雨で", [], [{ start: 4, end: 6 }]).metrics.grammar).toBe(50);
  });
});

describe("units", () => {
  it("stripPunctuation maps back to base", () => {
    const { chars, map } = stripPunctuation("はい、そう。");
    expect(chars.join("")).toBe("はいそう");
    expect(map).toEqual([0, 1, 3, 4]);
  });
  it("chunkUnits are contiguous ranges", () => {
    expect(chunkUnits(["今日は", "雨です。"])).toEqual([{ start: 0, end: 3 }, { start: 3, end: 7 }]);
  });
  it("grapheme4Units never splits an emoji", () => {
    const base = "👨‍👩‍👧家族です";
    const units = grapheme4Units(base);
    expect(units[0]).toEqual({ start: 0, end: 5 + 3 });
    expect(units).toHaveLength(2);
    expect(units[1]).toEqual({ start: 8, end: Array.from(base).length });
  });
});

describe("Typing optional symbols", () => {
  const sc = (base: string, input: string, hinted: { start: number; end: number }[] = []) =>
    scoreTyping(normalizeJa(base), input, hinted, []);
  it.each(["♪", "〜", "～", "→", "※"])("%s omitted costs nothing, typed is not extra", (sym) => {
    const base = `今日は楽しいですね${sym}`;
    const omitted = sc(base, "今日は楽しいですね");
    expect(omitted.score).toBe(100);
    expect(omitted.diff.some((d) => d.type === "missing")).toBe(false);
    const typed = sc(base, base);
    expect(typed.diff.some((d) => d.type === "extra")).toBe(false);
    expect(typed.score).toBe(100);
  });
  it.each(["%", "¥", "+", "−"])("%s stays required", (sym) => {
    const r = sc(`50${sym}`, "50");
    expect(r.diff.filter((d) => d.type === "missing")).toHaveLength(1);
  });
  it("a hinted range after a stripped symbol marks exactly those chars", () => {
    const r = sc("あ♪いう", "", [{ start: 2, end: 3 }]);
    expect(r.diff.map((d) => d.type)).toEqual(["missing", "hinted", "missing"]);
  });
  it("Kanji ratio ignores a stripped symbol", () => {
    expect(sc("漢字♪", "漢字").metrics.kanji).toBe(100);
  });
  it("exports the allowlist", () => expect(TYPING_OPTIONAL.test("♪")).toBe(true));
});

describe("grapheme1Units", () => {
  it("one range per grapheme", () => expect(grapheme1Units(normalizeJa("今は英語"))).toHaveLength(4));
  it("skips optional symbols and punctuation, maps to base offsets", () => {
    expect(grapheme1Units("あ♪、い")).toEqual([{ start: 0, end: 1 }, { start: 3, end: 4 }]);
  });
  it("never splits an emoji", () => {
    expect(grapheme1Units("あ👨‍👩‍👧")).toEqual([{ start: 0, end: 1 }, { start: 1, end: 6 }]);
  });
  it("a hinted unit marks exactly its char", () => {
    const base = "今日は楽しい";
    const r = scoreTyping(base, "", [grapheme1Units(base)[2]!], []);
    expect(r.diff.map((d) => d.type)).toEqual(["missing", "missing", "hinted", "missing", "missing", "missing"]);
  });
});
