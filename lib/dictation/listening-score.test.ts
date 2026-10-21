import { describe, expect, it } from "vitest";
import { chunkUnits, grapheme4Units, scoreTyping, scoreWordBank, stripPunctuation } from "./listening-score";

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

describe("scoreTyping", () => {
  it("ignores punctuation", () => {
    expect(scoreTyping("今日は雨です。", "今日は雨です", [], []).score).toBe(100);
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
