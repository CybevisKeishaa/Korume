import { describe, expect, it } from "vitest";
import { buildKanjiSearchIndex, classifyKanjiQuery, KANJI_SEARCH_LIMIT, searchKanji, type KanjiSearchRow } from "./search";

const row = (literal: string, over: Partial<KanjiSearchRow> = {}): KanjiSearchRow => ({
  literal, onReadings: [], kunReadings: [], meaningsEn: [], viReadings: [], viMeanings: [], freq: null, strokeCount: 10, ...over,
});

const ROWS: KanjiSearchRow[] = [
  row("日", { onReadings: ["ニチ", "ジツ"], kunReadings: ["ひ", "-び"], meaningsEn: ["day", "sun", "Japan"], viReadings: ["Nhật"], viMeanings: ["vi-sun"], freq: 1, strokeCount: 4 }),
  row("本", { onReadings: ["ホン"], kunReadings: ["もと"], meaningsEn: ["book", "origin"], viReadings: ["Bản", "Bổn"], freq: 10, strokeCount: 5 }),
  row("語", { onReadings: ["ゴ"], kunReadings: ["かた.る"], meaningsEn: ["word", "speech", "language"], viReadings: ["Ngữ", "Ngứ"], viMeanings: ["vi-word; vi-speech"], freq: 301, strokeCount: 14 }),
  row("食", { onReadings: ["ショク"], kunReadings: ["く.う", "た.べる"], meaningsEn: ["eat", "food"], viReadings: ["Thực"], viMeanings: ["vi-eat"], freq: 328, strokeCount: 9 }),
  row("喰", { kunReadings: ["く.う", "く.らう"], meaningsEn: ["eat", "drink"], viReadings: ["Thực"], strokeCount: 12 }),
  row("御", { onReadings: ["ギョ", "ゴ"], kunReadings: ["おん-"], meaningsEn: ["honorable"], viReadings: ["Ngự"], freq: 657, strokeCount: 12 }),
  row("五", { onReadings: ["ゴ"], kunReadings: ["いつ"], meaningsEn: ["five"], viReadings: ["Ngũ"], freq: 31, strokeCount: 4 }),
  row("呉", { onReadings: ["ゴ"], meaningsEn: ["give"], viReadings: ["Ngô"], freq: null, strokeCount: 7 }),
  row("鯉", { kunReadings: ["こい"], meaningsEn: ["carp"], viReadings: ["Lí"], freq: 2000, strokeCount: 18 }),
  row("𠮟", { onReadings: ["シツ"], kunReadings: ["しか.る"], meaningsEn: ["scold"], strokeCount: 5 }),
  row("丁", { meaningsEn: ["x - y"], viMeanings: ["vi-x, (vi-y)"], strokeCount: 2 }), // punctuation standing alone
  row("和", { meaningsEn: ["harmony", "Japanese style"], viReadings: ["Hòa"], freq: 124, strokeCount: 8 }),
];
const index = buildKanjiSearchIndex(ROWS);
const literals = (query: string, curated: Map<string, string> = new Map()) => searchKanji(index, curated, query).results.map((r) => r.literal);

describe("classifyKanjiQuery", () => {
  it("any Han code point → chars, in order, deduped, non-BMP kept, kana dropped", () => {
    expect(classifyKanjiQuery("日本語")).toEqual({ mode: "chars", chars: ["日", "本", "語"] });
    expect(classifyKanjiQuery("食べる")).toEqual({ mode: "chars", chars: ["食"] });
    expect(classifyKanjiQuery("日日本")).toEqual({ mode: "chars", chars: ["日", "本"] });
    expect(classifyKanjiQuery("𠮟る")).toEqual({ mode: "chars", chars: ["𠮟"] });
  });

  it("kana only → reading, katakana folded to hiragana; full-width and half-width forms fold first", () => {
    expect(classifyKanjiQuery("たべる")).toEqual({ mode: "reading", kana: "たべる" });
    expect(classifyKanjiQuery("ニチ")).toEqual({ mode: "reading", kana: "にち" });
    expect(classifyKanjiQuery("ﾆﾁ")).toEqual({ mode: "reading", kana: "にち" });
  });

  it("anything else → text, lower-cased NFC", () => {
    expect(classifyKanjiQuery("Ngữ")).toEqual({ mode: "text", text: "ngữ" });
    expect(classifyKanjiQuery("ｅａｔ")).toEqual({ mode: "text", text: "eat" });
  });
});

describe("searchKanji", () => {
  it("chars: each Han code point of the query, in the query's order, only those in the snapshot", () => {
    const response = searchKanji(index, new Map(), "日本語");
    expect(response.mode).toBe("chars");
    expect(response.query).toBe("日本語");
    expect(response.results.map((r) => r.literal)).toEqual(["日", "本", "語"]);
    expect(literals("食べる")).toEqual(["食"]);
    expect(literals("𠮟")).toEqual(["𠮟"]);
    expect(literals("語猫")).toEqual(["語"]); // 猫 is not in this snapshot
  });

  it("a result carries Hán Việt, the K16 Vietnamese meaning (curated first) and the English line", () => {
    expect(searchKanji(index, new Map(), "語").results[0]).toEqual({ literal: "語", hanViet: ["Ngữ", "Ngứ"], meaningVi: "vi-word; vi-speech", meaningEn: "word, speech, language" });
    expect(searchKanji(index, new Map([["語", "vi-own"]]), "語").results[0]?.meaningVi).toBe("vi-own");
    expect(searchKanji(index, new Map(), "本").results[0]?.meaningVi).toBeNull();
  });

  it("reading: kun okurigana dots and affix dashes are stripped, katakana on folded; exact before prefix", () => {
    expect(searchKanji(index, new Map(), "たべる").mode).toBe("reading");
    expect(literals("たべる")).toEqual(["食"]);
    expect(literals("にち")).toEqual(["日"]);
    expect(literals("び")).toEqual(["日"]); // -び
    expect(literals("おん")).toEqual(["御"]); // おん-
    // ご is an exact on reading of four: frequency order, the one without a frequency last.
    expect(literals("ご")).toEqual(["五", "語", "御", "呉"]);
    // く: no exact reading; prefix matches く.う (食 328, 喰 no freq)
    expect(literals("く")).toEqual(["食", "喰"]);
    expect(literals("こ")).toEqual(["鯉"]);
  });

  it("reading: an exact match outranks a more frequent prefix match", () => {
    const local = buildKanjiSearchIndex([row("甲", { kunReadings: ["かた"], freq: 900 }), row("乙", { kunReadings: ["かた.る"], freq: 1 })]);
    expect(searchKanji(local, new Map(), "かた").results.map((r) => r.literal)).toEqual(["甲", "乙"]);
  });

  it("text: Hán Việt matches whatever the case and the tone-mark placement (hvdic's fold)", () => {
    expect(searchKanji(index, new Map(), "ngữ").mode).toBe("text");
    expect(literals("ngữ")).toEqual(["語"]);
    expect(literals("NHẬT")).toEqual(["日"]);
    expect(literals("hoà")).toEqual(["和"]); // KANJIDIC2 writes Hòa
  });

  it("text: a plain-ASCII syllable also matches Hán Việt without its marks, after the exact matches", () => {
    expect(literals("ngu")).toEqual(["五", "語", "御"]);
    expect(literals("nhat")).toEqual(["日"]);
  });

  it("text: Vietnamese glosses and the curated meaning match on a word boundary; a whole gloss is exact", () => {
    expect(literals("vi-eat")).toEqual(["食"]);
    expect(literals("vi-speech")).toEqual(["語"]);
    expect(literals("vi-e")).toEqual([]); // a word cut short is no match
    expect(literals("vi-own", new Map([["本", "vi-own, vi-other"]]))).toEqual(["本"]);
  });

  it("text: English meanings match a whole word; an exact meaning outranks a word inside one", () => {
    expect(literals("language")).toEqual(["語"]);
    expect(literals("eat")).toEqual(["食", "喰"]);
    expect(literals("Japanese")).toEqual(["和"]);
    expect(literals("japan")).toEqual(["日"]); // "Japanese style" is not the word "japan"
    const local = buildKanjiSearchIndex([row("甲", { meaningsEn: ["eat greedily"], freq: 1 }), row("乙", { meaningsEn: ["eat"], freq: 900 })]);
    expect(searchKanji(local, new Map(), "eat").results.map((r) => r.literal)).toEqual(["乙", "甲"]);
  });

  it("ties fall to frequency (nulls last), then stroke count", () => {
    const local = buildKanjiSearchIndex([
      row("乙", { meaningsEn: ["x"], freq: null, strokeCount: 3 }),
      row("甲", { meaningsEn: ["x"], freq: null, strokeCount: 2 }),
      row("丙", { meaningsEn: ["x"], freq: 50, strokeCount: 9 }),
    ]);
    // 甲 (U+7532) before 乙 (U+4E59): stroke count, not code point, breaks the tie.
    expect(searchKanji(local, new Map(), "x").results.map((r) => r.literal)).toEqual(["丙", "甲", "乙"]);
  });

  it(`caps the results at ${KANJI_SEARCH_LIMIT}`, () => {
    const many = buildKanjiSearchIndex(Array.from({ length: 40 }, (_, i) => row(String.fromCodePoint(0x4e00 + i), { meaningsEn: ["x"], freq: i + 1 })));
    const results = searchKanji(many, new Map(), "x").results;
    expect(results).toHaveLength(KANJI_SEARCH_LIMIT);
    expect(results[0]?.literal).toBe("一");
  });

  it("no match is an empty list, never an error", () => {
    expect(literals("zzz")).toEqual([]);
    expect(literals("ぬぬぬ")).toEqual([]);
    for (const junk of [".", "-", "・", "ー", "?!", "("]) expect(literals(junk), junk).toEqual([]);
  });
});
