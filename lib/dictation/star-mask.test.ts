import { describe, expect, it } from "vitest";
import { grapheme1Units } from "./listening-score";
import { starFill, starMask } from "./star-mask";

describe("starMask", () => {
  it("stars graphemes, shows punctuation and optional symbols in place", () => {
    const m = starMask("みなさん、こんにちは♪");
    expect(m.map((c) => (c.kind === "star" ? "*" : c.text)).join("")).toBe("****、*****♪");
    expect(m.filter((c) => c.kind === "star").map((c) => (c as { unit: number }).unit)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("keeps an emoji as one star", () => {
    expect(starMask("あ👨‍👩‍👧")).toEqual([{ kind: "star", unit: 0 }, { kind: "star", unit: 1 }]);
  });
});

describe("starFill", () => {
  const piece = (chunk: string, display = chunk) => ({ chunk, display });
  it("gives the scored graphemes of the pieces, punctuation skipped, raw text shown", () => {
    expect(starFill([piece("を")])).toEqual(["を"]);
    expect(starFill([piece("けど。")])).toEqual(["け", "ど"]);
    expect(starFill([piece("Google", "Ｇｏｏｇｌｅ")])).toEqual(["Ｇ", "ｏ", "ｏ", "ｇ", "ｌ", "ｅ"]);
  });
  it("any prefix of any order equals the scored graphemes of the concatenated displays", () => {
    const lines = [["お", "店", "を", "出", "る"], ["行く", "けど。", "雨、", "です"], ["時", "時", "時", "Go", "ogle"]].map((l) => l.map((c) => piece(c)));
    for (let i = 0; i < 200; i++) {
      const pieces = lines[i % 3]!.map((p) => ({ p, r: Math.random() })).sort((a, b) => a.r - b.r).map(({ p }) => p);
      const prefix = pieces.slice(0, Math.floor(Math.random() * (pieces.length + 1)));
      const joined = prefix.map((p) => p.display).join("");
      expect(starFill(prefix).join("")).toBe(grapheme1Units(joined).map((u) => Array.from(joined).slice(u.start, u.end).join("")).join(""));
    }
  });
});

