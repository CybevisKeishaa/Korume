import { describe, expect, it } from "vitest";
import { canonicalizeSentence, fingerprint } from "./canonical";

describe("canonicalizeSentence", () => {
  it.each([
    ["今日は雨です。", "今日は雨です。"],
    ["  今日は雨です。\r\n", "今日は雨です。"],
    ["ＡＢＣ１２３", "ABC123"],
    ["今日は  雨", "今日は 雨"],
    ["今日は　　雨", "今日は 雨"],
    ["ｶﾀｶﾅ", "カタカナ"],
  ])("canonicalizes %j", (input, out) => expect(canonicalizeSentence(input)).toBe(out));
});

describe("fingerprint", () => {
  it("is the sha256 hex of the canonical text", () => {
    expect(fingerprint("  今日は雨です。\r\n")).toBe(fingerprint("今日は雨です。"));
    expect(fingerprint("今日は雨です。")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps meaning-bearing punctuation and particles apart", () => {
    const base = fingerprint("行きます");
    for (const other of ["行きます？", "行きます！", "行きます…", "行きます。"]) expect(fingerprint(other)).not.toBe(base);
    expect(fingerprint("行きます？")).not.toBe(fingerprint("行きます！"));
    expect(fingerprint("私は行く")).not.toBe(fingerprint("私が行く"));
  });
});
