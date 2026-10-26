import { describe, expect, it } from "vitest";
import { starMask } from "./star-mask";

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
