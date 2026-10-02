import { describe, expect, it } from "vitest";
import { matchGrammar, patternFragments } from "./grammar-matcher";
import { tokenSpans } from "./spans";

/** kuromoji's segmentation of each test sentence, written out so the matcher is tested without the dictionary. */
function line(text: string, tokens: [surface: string, base: string, pos: string][]) {
  const spans = tokenSpans(text, tokens.map(([surface]) => surface));
  return tokens.map(([surface, base, pos], index) => ({ surface, base, pos, span: spans[index] ?? { start: 0, end: 0 } }));
}

const PATTERNS = [
  { id: "g-shimau", title: "〜てしまう (end up)", structurePattern: "〜てしまう" },
  { id: "g-youni", title: "〜ように (so that)", structurePattern: "〜ように" },
  { id: "g-must", title: "〜なければならない (must)", structurePattern: "〔verb ない-stem〕なければならない" },
  { id: "g-wa", title: "は (topic marker)", structurePattern: "〔Noun〕は 〔comment〕" },
  { id: "g-none", title: "no pattern", structurePattern: null },
];

describe("patternFragments", () => {
  it("keeps the literal Japanese and drops slots, tildes and spaces", () => {
    expect(patternFragments("〔verb ない-stem〕なければならない")).toEqual(["なければならない"]);
    expect(patternFragments("〔verb て-form〕ください")).toEqual(["ください"]);
    expect(patternFragments("〔Noun1〕の 〔Noun2〕")).toEqual(["の"]);
    expect(patternFragments("〜てしまう")).toEqual(["てしまう"]);
    expect(patternFragments(null)).toEqual([]);
  });
});

describe("matchGrammar", () => {
  it("matches a conjugated pattern through the base form of its last token", () => {
    const tokens = line("全部食べてしまった", [["全部", "全部", "名詞"], ["食べ", "食べる", "動詞"], ["て", "て", "助詞"], ["しまっ", "しまう", "動詞"], ["た", "た", "助動詞"]]);
    expect(matchGrammar(tokens, PATTERNS)).toEqual([
      { grammarPointId: "g-shimau", title: "〜てしまう (end up)", structure: "〜てしまう", span: { start: 4, end: 8 } },
    ]);
  });

  it("matches a pattern spread over several tokens", () => {
    const tokens = line("行かなければならない", [["行か", "行く", "動詞"], ["なけれ", "ない", "助動詞"], ["ば", "ば", "助詞"], ["なら", "なる", "動詞"], ["ない", "ない", "助動詞"]]);
    expect(matchGrammar(tokens, PATTERNS).map((m) => [m.grammarPointId, m.span])).toEqual([["g-must", { start: 2, end: 10 }]]);
  });

  it("matches ように and the topic particle, each occurrence once", () => {
    const tokens = line("私は忘れないように書く", [
      ["私", "私", "名詞"], ["は", "は", "助詞"], ["忘れ", "忘れる", "動詞"], ["ない", "ない", "助動詞"],
      ["よう", "よう", "名詞"], ["に", "に", "助詞"], ["書く", "書く", "動詞"],
    ]);
    expect(matchGrammar(tokens, PATTERNS).map((m) => [m.grammarPointId, m.span])).toEqual([
      ["g-wa", { start: 1, end: 2 }],
      ["g-youni", { start: 6, end: 9 }],
    ]);
  });

  it("never matches inside a longer word or a non-particle one-character token", () => {
    const tokens = line("はなしてしまいたい", [["はなし", "はなす", "動詞"], ["て", "て", "助詞"], ["しまい", "しまう", "動詞"], ["たい", "たい", "助動詞"]]);
    expect(matchGrammar(tokens, PATTERNS).map((m) => m.grammarPointId)).toEqual(["g-shimau"]);
    const noun = line("歯が痛い", [["歯", "歯", "名詞"], ["が", "が", "助詞"], ["痛い", "痛い", "形容詞"]]);
    expect(matchGrammar(noun, [{ id: "g-ha", title: "は", structurePattern: "は" }, { id: "g-teki", title: "痛", structurePattern: "痛" }])).toEqual([]);
  });
});
