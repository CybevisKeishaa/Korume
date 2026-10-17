import { describe, expect, it } from "vitest";
import { alignWords } from "./align-words";
import type { AssessmentWord } from "./assessment";

const w = (word: string, accuracy: number | null = 90, errorType: AssessmentWord["errorType"] = "None"): AssessmentWord => ({ word, accuracy, errorType });

describe("alignWords", () => {
  it("maps Azure words onto the line, punctuation uncoloured", () => {
    expect(alignWords("今日は雨です。", [w("今日"), w("は"), w("雨", 40, "Mispronunciation"), w("です")])).toEqual([
      { start: 0, end: 2, accuracy: 90, errorType: "None" },
      { start: 2, end: 3, accuracy: 90, errorType: "None" },
      { start: 3, end: 4, accuracy: 40, errorType: "Mispronunciation" },
      { start: 4, end: 6, accuracy: 90, errorType: "None" },
    ]);
  });

  it("tolerates a different word split", () => {
    const spans = alignWords("注文をお願いします。", [w("注文を"), w("お願い"), w("します")]);
    expect(spans).toHaveLength(3);
    expect(spans?.map((s) => [s.start, s.end])).toEqual([[0, 3], [3, 6], [6, 9]]);
  });

  it("colours an omitted reference word and ignores insertions", () => {
    const spans = alignWords("ありがとうございました。", [w("ありがとう"), w("ございました", 0, "Omission"), w("ね", 0, "Insertion")]);
    expect(spans?.[1]).toEqual({ start: 5, end: 11, accuracy: 0, errorType: "Omission" });
    expect(spans).toHaveLength(2);
  });

  it("returns null under 90 % coverage", () => {
    expect(alignWords("今日は雨です。", [w("明日"), w("晴れ")])).toBeNull();
    expect(alignWords("abcdefghij", [w("abcdefghXY")])).toBeNull();
  });

  it("accepts exactly 90 % coverage", () => {
    expect(alignWords("abcdefghij", [w("abcdefghiX", null)])).toEqual([
      { start: 0, end: 10, accuracy: null, errorType: "None" },
    ]);
  });

  it("normalises full-width/half-width differences per character", () => {
    expect(alignWords("ＡＢＣです", [w("ABC"), w("です")])).toEqual([
      { start: 0, end: 3, accuracy: 90, errorType: "None" },
      { start: 3, end: 5, accuracy: 90, errorType: "None" },
    ]);
  });

  it("indexes Unicode code points and leaves internal punctuation and spaces uncoloured", () => {
    expect(alignWords("𠮷、野 家", [w("𠮷野家")])).toEqual([
      { start: 0, end: 1, accuracy: 90, errorType: "None" },
      { start: 2, end: 3, accuracy: 90, errorType: "None" },
      { start: 4, end: 5, accuracy: 90, errorType: "None" },
    ]);
  });

  it("returns null with no reference characters or no aligned detail", () => {
    expect(alignWords(" 。！？", [w("今日")])).toBeNull();
    expect(alignWords("今日", [])).toBeNull();
    expect(alignWords("今日", [w("今日", 90, "Insertion")])).toBeNull();
  });

  it("preserves original indices when a character normalises to several", () => {
    expect(alignWords("ﬀです", [w("ff"), w("です")])).toEqual([
      { start: 0, end: 1, accuracy: 90, errorType: "None" },
      { start: 1, end: 3, accuracy: 90, errorType: "None" },
    ]);
  });
});
