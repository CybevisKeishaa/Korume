import { describe, expect, it } from "vitest";
import { graphemes, hasKanji, readingRevealsTarget } from "./japanese";

describe("graphemes (spec W §1.2)", () => {
  it("gives small kana and the long-vowel mark their own cell", () => {
    expect(graphemes("ちょっと")).toEqual(["ち", "ょ", "っ", "と"]);
    expect(graphemes("コーヒー")).toEqual(["コ", "ー", "ヒ", "ー"]);
  });
  it("counts a surrogate-pair kanji once, never per UTF-16 code unit", () => {
    expect("𠮟る".length).toBe(3);
    expect(graphemes("𠮟る")).toEqual(["𠮟", "る"]);
  });
});

describe("hasKanji (spec W §1.3)", () => {
  it("is true for kanji and for 々, false for kana, katakana and mixed Latin", () => {
    expect(hasKanji("苦手")).toBe(true);
    expect(hasKanji("人々")).toBe(true);
    expect(hasKanji("々")).toBe(true);
    expect(hasKanji("する")).toBe(false);
    expect(hasKanji("コーヒー")).toBe(false);
    expect(hasKanji("Tシャツ")).toBe(false);
    expect(hasKanji("ゝゞヽヾ")).toBe(false);
  });
});

describe("readingRevealsTarget (spec W §2)", () => {
  it("drops a reading that is the answer itself, across scripts", () => {
    expect(readingRevealsTarget("する", "する")).toBe(true);
    expect(readingRevealsTarget("とても", "とても")).toBe(true);
    expect(readingRevealsTarget("カメラ", "かめら")).toBe(true);
    expect(readingRevealsTarget("ｶﾒﾗ", "かめら")).toBe(true); // NFKC folds half-width katakana
  });
  it("keeps a reading that differs from the written form", () => {
    expect(readingRevealsTarget("Tシャツ", "ティーシャツ")).toBe(false);
    expect(readingRevealsTarget("苦手", "にがて")).toBe(false);
    expect(readingRevealsTarget("する", undefined)).toBe(false);
  });
});
