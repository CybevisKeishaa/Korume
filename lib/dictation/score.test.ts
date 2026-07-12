import { describe, expect, it } from "vitest";
import { scoreDictation } from "./score";

describe("scoreDictation — exact & empty", () => {
  it("scores an exact match as 100 with an all-match diff", () => {
    const r = scoreDictation("今日は良い天気ですね", "今日は良い天気ですね");
    expect(r.accuracy).toBe(100);
    expect(r.diff.every((d) => d.type === "match")).toBe(true);
    expect(r.diff).toHaveLength(10);
  });

  it("scores empty input against a non-empty reference as 0", () => {
    const r = scoreDictation("こんにちは", "");
    expect(r.accuracy).toBe(0);
    expect(r.diff.every((d) => d.type === "missing")).toBe(true);
    expect(r.diff).toHaveLength(5);
  });

  it("guards against an empty reference, returning 0 regardless of input", () => {
    expect(scoreDictation("", "").accuracy).toBe(0);
    expect(scoreDictation("", "").diff).toEqual([]);

    const r = scoreDictation("", "abc");
    expect(r.accuracy).toBe(0);
    expect(r.diff).toEqual([
      { type: "extra", actual: "a" },
      { type: "extra", actual: "b" },
      { type: "extra", actual: "c" },
    ]);
  });
});

describe("scoreDictation — deterministic diffs", () => {
  it("flags a single wrong character as a substitution", () => {
    const r = scoreDictation("abc", "abd");
    expect(r.diff).toEqual([
      { type: "match", expected: "a", actual: "a" },
      { type: "match", expected: "b", actual: "b" },
      { type: "wrong", expected: "c", actual: "d" },
    ]);
    expect(r.accuracy).toBeCloseTo(66.7, 5);
  });

  it("flags a missing tail as deletions and lowers accuracy proportionally", () => {
    const r = scoreDictation("abcde", "abc");
    expect(r.diff).toEqual([
      { type: "match", expected: "a", actual: "a" },
      { type: "match", expected: "b", actual: "b" },
      { type: "match", expected: "c", actual: "c" },
      { type: "missing", expected: "d" },
      { type: "missing", expected: "e" },
    ]);
    expect(r.accuracy).toBe(60);
  });

  it("flags trailing extra characters as insertions without penalizing accuracy", () => {
    const r = scoreDictation("abc", "abcde");
    expect(r.diff).toEqual([
      { type: "match", expected: "a", actual: "a" },
      { type: "match", expected: "b", actual: "b" },
      { type: "match", expected: "c", actual: "c" },
      { type: "extra", actual: "d" },
      { type: "extra", actual: "e" },
    ]);
    expect(r.accuracy).toBe(100);
  });
});

describe("scoreDictation — normalization is applied before scoring", () => {
  it("treats full-width and half-width variants as equal", () => {
    const r = scoreDictation("アイウ", "ｱｲｳ");
    expect(r.accuracy).toBe(100);
    expect(r.diff.every((d) => d.type === "match")).toBe(true);
  });

  it("ignores spacing differences entirely", () => {
    const r = scoreDictation("今日は良い天気", " 今日は  良い天気 ");
    expect(r.accuracy).toBe(100);
  });
});

describe("scoreDictation — realistic partial match", () => {
  it("scores a dropped final particle as a single missing character", () => {
    const reference = "今日は良い天気ですね";
    const r = scoreDictation(reference, "今日は良い天気です");
    expect(r.diff.at(-1)).toEqual({ type: "missing", expected: "ね" });
    // 9 of 10 reference characters matched.
    expect(r.accuracy).toBeCloseTo(90, 5);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const a = scoreDictation("桜が咲いています", "桜は咲いてます");
    const b = scoreDictation("桜が咲いています", "桜は咲いてます");
    expect(a).toEqual(b);
  });
});
