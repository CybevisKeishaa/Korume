import { describe, expect, it } from "vitest";
import { snapSpanToTokens, tokenSpans } from "./spans";

const TEXT = "𠮷野家に行く";
const tokens = tokenSpans(TEXT, ["𠮷野家", "に", "行く"]).map((span) => ({ span }));

describe("tokenSpans", () => {
  it("measures UTF-16 code units, so a non-BMP kanji is two", () => {
    expect(tokenSpans(TEXT, ["𠮷野家", "に", "行く"])).toEqual([{ start: 0, end: 4 }, { start: 4, end: 5 }, { start: 5, end: 7 }]);
  });

  it("skips text the tokenizer did not return, such as spaces", () => {
    expect(tokenSpans("雨 です", ["雨", "です"])).toEqual([{ start: 0, end: 1 }, { start: 2, end: 4 }]);
  });

  it("refuses surfaces that are not in the text in order", () => {
    expect(() => tokenSpans(TEXT, ["行く", "に"])).toThrow();
  });
});

describe("snapSpanToTokens", () => {
  it("widens a span to the whole tokens it touches", () => {
    expect(snapSpanToTokens(TEXT, tokens, { start: 1, end: 5 })).toEqual({ start: 0, end: 5 });
    expect(snapSpanToTokens(TEXT, tokens, { start: 5, end: 6 })).toEqual({ start: 5, end: 7 });
    expect(snapSpanToTokens(TEXT, tokens, { start: 0, end: 7 })).toEqual({ start: 0, end: 7 });
  });

  it("returns null for an empty, reversed or out-of-bounds span, or one that crosses no token", () => {
    expect(snapSpanToTokens(TEXT, tokens, { start: 2, end: 2 })).toBeNull();
    expect(snapSpanToTokens(TEXT, tokens, { start: 3, end: 1 })).toBeNull();
    expect(snapSpanToTokens(TEXT, tokens, { start: -1, end: 2 })).toBeNull();
    expect(snapSpanToTokens(TEXT, tokens, { start: 6, end: 8 })).toBeNull();
    const spaced = tokenSpans("雨 です", ["雨", "です"]).map((span) => ({ span }));
    expect(snapSpanToTokens("雨 です", spaced, { start: 1, end: 2 })).toBeNull();
  });
});
