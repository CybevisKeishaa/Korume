import { describe, expect, it } from "vitest";
import { posKey } from "./view";

describe("posKey", () => {
  it("maps JMdict entity codes and their expansions to one display key", () => {
    const cases: [string | null, string][] = [
      ["n", "noun"], ["noun (common) (futsuumeishi)", "noun"], ["n-adv", "noun"],
      ["v5r", "verb"], ["vs", "verb"], ["Godan verb with 'ru' ending", "verb"],
      ["adj-i", "adjective"], ["adj-na", "adjective"], ["adv", "adverb"], ["exp", "expression"],
      [null, "other"], ["prt", "other"],
    ];
    expect(cases.map(([code]) => posKey(code))).toEqual(cases.map(([, key]) => key));
  });
});
