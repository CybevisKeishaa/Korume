import { describe, expect, it } from "vitest";
import { splitIntoSentences } from "./reading-format";

describe("splitIntoSentences", () => {
  it("splits on 。！？, keeping the punctuation attached to its sentence", () => {
    expect(splitIntoSentences("今日は晴れです。明日は雨ですか？楽しみ！")).toEqual([
      "今日は晴れです。",
      "明日は雨ですか？",
      "楽しみ！",
    ]);
  });

  it("keeps a trailing sentence with no closing punctuation", () => {
    expect(splitIntoSentences("これは例です")).toEqual(["これは例です"]);
  });

  it("treats newlines as their own chunk", () => {
    expect(splitIntoSentences("一行目。\n二行目。")).toEqual(["一行目。", "\n", "二行目。"]);
  });

  it("returns an empty array for an empty string", () => {
    expect(splitIntoSentences("")).toEqual([]);
  });
});
