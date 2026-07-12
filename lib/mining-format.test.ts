import { describe, expect, it } from "vitest";
import { splitSentenceForEmphasis } from "./mining-format";

describe("splitSentenceForEmphasis", () => {
  it("splits a sentence around a single occurrence of the target word", () => {
    const parts = splitSentenceForEmphasis("私は学校に行きます", "学校");
    expect(parts).toEqual([
      { text: "私は", emphasized: false },
      { text: "学校", emphasized: true },
      { text: "に行きます", emphasized: false },
    ]);
  });

  it("emphasizes every occurrence when the target word appears more than once", () => {
    const parts = splitSentenceForEmphasis("猫が猫を見た", "猫");
    expect(parts).toEqual([
      { text: "猫", emphasized: true },
      { text: "が", emphasized: false },
      { text: "猫", emphasized: true },
      { text: "を見た", emphasized: false },
    ]);
  });

  it("returns the whole sentence unemphasized when the target word isn't found", () => {
    const parts = splitSentenceForEmphasis("こんにちは", "学校");
    expect(parts).toEqual([{ text: "こんにちは", emphasized: false }]);
  });

  it("returns the whole sentence unemphasized for an empty target word", () => {
    const parts = splitSentenceForEmphasis("こんにちは", "");
    expect(parts).toEqual([{ text: "こんにちは", emphasized: false }]);
  });

  it("handles the target word at the very start or end of the sentence", () => {
    const parts = splitSentenceForEmphasis("学校です", "学校");
    expect(parts).toEqual([
      { text: "学校", emphasized: true },
      { text: "です", emphasized: false },
    ]);
  });
});
