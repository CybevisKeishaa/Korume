import { describe, expect, it } from "vitest";
import { rankKanjiWords } from "./kanji-words";
import type { JmdictEntryRow } from "./jmdict";

function entry(entSeq: number, kanjiForms: string[], common: boolean): JmdictEntryRow {
  return { entSeq, kanjiForms, kanaForms: ["か"], senses: [], common };
}

describe("rankKanjiWords", () => {
  it("keeps entries containing the literal, common first, then shorter headword, then ent_seq", () => {
    const entries = [
      entry(5, ["緑色"], false),
      entry(4, ["新緑"], true),
      entry(3, ["緑"], false),
      entry(2, ["青"], true),
      entry(1, ["緑化運動"], true),
      entry(6, ["黄緑"], true),
    ];
    expect(rankKanjiWords("緑", entries, 30)).toEqual([4, 6, 1, 3, 5]);
    expect(rankKanjiWords("緑", entries, 2)).toEqual([4, 6]);
  });

  it("measures the shortest kanji form that contains the literal", () => {
    expect(rankKanjiWords("緑", [entry(1, ["緑化運動", "緑化"], false), entry(2, ["緑色"], false)], 30)).toEqual([1, 2]);
  });
});
