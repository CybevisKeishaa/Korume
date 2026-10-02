import { describe, expect, it } from "vitest";
import { parseKanjiLiteral } from "./literal";

describe("parseKanjiLiteral", () => {
  it.each([
    ["緑", "緑"],
    ["%E7%B7%91", "緑"],
    ["𠮟", "𠮟"],
    ["緑色", null],
    ["a", null],
    ["み", null],
    ["%E7%B7", null],
    ["", null],
  ])("%j → %j", (raw, expected) => expect(parseKanjiLiteral(raw)).toBe(expected));
});
