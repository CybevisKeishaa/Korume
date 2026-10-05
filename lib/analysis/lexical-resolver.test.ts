import { describe, expect, it } from "vitest";
import {
  entriesFor, isAutomaticLookupEligible, isLessonVocabularyEligible, resolveLexeme, type EntryRow, type VocabRow,
} from "./lexical-resolver";

const entry = (ent_seq: number, kanji: string[], kana: string[], gloss: string, common = true): EntryRow =>
  ({ ent_seq, kanji_forms: kanji, kana_forms: kana, senses: [{ gloss: [gloss] }], common, jlpt: null });

// 人: the suffix entry has the lower ent_seq and is common — exactly what the old first-entry rule picked.
const JIN = entry(2000, ["人"], ["じん"], "-ian");
const HITO = entry(3000, ["人"], ["ひと"], "person");
const NIN = entry(4000, ["人"], ["にん"], "counter for people", false);
const HANASU = entry(5000, ["話す"], ["はなす"], "to speak");
const HANASHI = entry(5100, ["話"], ["はなし"], "talk; story");
const IKU = entry(6000, ["行く", "逝く"], ["いく", "ゆく"], "to go");
const YOMU = entry(7000, ["読む"], ["よむ"], "to read");
const HOMOPHONE = entry(5200, ["放す"], ["はなす"], "to let go");

describe("resolveLexeme — contextual reading (spec §1.3–§1.5)", () => {
  it("picks ひと for 人 read ヒト, though the suffix entry じん ranks first without a reading", () => {
    const resolved = resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [JIN, HITO, NIN]);
    expect(resolved?.matches[0]).toMatchObject({ entSeq: 3000, headword: "人", reading: "ひと", glossEn: "person" });
    expect(resolved?.readingMatch).toBe("exact");
    expect(entriesFor("人", "人", [JIN, HITO, NIN])[0]?.entSeq).toBe(2000); // reading-less callers: today's ranking
  });

  it("stem-matches inflected verbs and shows the dictionary-form kana", () => {
    const hanashi = resolveLexeme({ surface: "話し", base: "話す", reading: "ハナシ" }, [HANASU, HANASHI]);
    expect(hanashi?.matches[0]).toMatchObject({ entSeq: 5000, reading: "はなす" });
    expect(hanashi?.readingMatch).toBe("stem");
    expect(resolveLexeme({ surface: "行っ", base: "行く", reading: "イッ" }, [IKU])?.matches[0]?.reading).toBe("いく");
    expect(resolveLexeme({ surface: "読ん", base: "読む", reading: "ヨン" }, [YOMU])?.matches[0]?.reading).toBe("よむ");
  });

  it("ranks an exact reading above a stem reading", () => {
    // 話し read はなし: one candidate matches the reading exactly, the other only by stem (はなす → はな).
    const stem = entry(8000, ["話す"], ["はなす"], "stem match", true);
    const exact = entry(8100, ["話す"], ["はなし"], "exact match", false);
    const resolved = resolveLexeme({ surface: "話し", base: "話す", reading: "ハナシ" }, [stem, exact]);
    expect(resolved?.matches.map((match) => match.entSeq)).toEqual([8100, 8000]);
    expect(resolved?.readingMatch).toBe("exact");
  });

  it("never lets a right-reading homophone with another headword beat the token's own written form", () => {
    const resolved = resolveLexeme({ surface: "話す", base: "話す", reading: "ハナス" }, [HOMOPHONE, HANASU]);
    expect(resolved?.matches.map((match) => match.entSeq)).toEqual([5000]);
  });

  it("does not stem-resolve a kana-only irregular and falls back to the headword ranking", () => {
    const suru = entry(9000, [], ["する"], "to do");
    const resolved = resolveLexeme({ surface: "し", base: "する", reading: "シ" }, [suru]);
    expect(resolved?.readingMatch).toBe("fallback");
    expect(resolved?.matches[0]?.reading).toBe("する");
  });

  it("shows the kana form the reading matched, never kana_forms[0] (spec §1.5)", () => {
    // きょう is kana_forms[0], so only a real match can produce こんにち.
    const exact = resolveLexeme({ surface: "今日", base: "今日", reading: "コンニチ" }, [entry(8200, ["今日"], ["きょう", "こんにち"], "today")]);
    expect(exact?.matches[0]).toMatchObject({ entSeq: 8200, reading: "こんにち" });
    expect(exact?.readingMatch).toBe("exact");
    // Same for a stem match: いく is the second kana form here.
    const stem = resolveLexeme({ surface: "行っ", base: "行く", reading: "イッ" }, [entry(8300, ["行く"], ["ゆく", "いく"], "to go")]);
    expect(stem?.matches[0]?.reading).toBe("いく");
    expect(stem?.readingMatch).toBe("stem");
  });
});

describe("resolveLexeme — vocab join (spec §1.7)", () => {
  const vocab = (id: string, word: string, reading: string | null, meaning_vi: string | null): VocabRow => ({ id, word, reading, meaning_vi });

  it("joins (headword, resolved reading) and carries the curated Vietnamese meaning", () => {
    const resolved = resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [JIN, HITO], [
      vocab("v-jin", "人", "じん", "người (nước)"), vocab("v-hito", "人", "ひと", "người"),
    ]);
    expect(resolved).toMatchObject({ vocabId: "v-hito", curatedVi: "người" });
  });

  it("gives the same word with two readings two vocab ids, never cross-attached", () => {
    const rows = [vocab("v-jin", "人", "じん", "người (nước)"), vocab("v-hito", "人", "ひと", "người")];
    expect(resolveLexeme({ surface: "人", base: "人", reading: "ジン" }, [JIN, HITO], rows)?.vocabId).toBe("v-jin");
    expect(resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [JIN, HITO], rows)?.vocabId).toBe("v-hito");
  });

  it("attaches nothing on a fallback reading of a multi-reading entry, even when one vocab row has the word", () => {
    const resolved = resolveLexeme({ surface: "行く", base: "行く", reading: null }, [IKU], [vocab("v-iku", "行く", "いく", "đi")]);
    expect(resolved?.readingMatch).toBe("fallback");
    expect(resolved).toMatchObject({ vocabId: null, curatedVi: null });
  });

  it("attaches on a fallback reading when the entry has a single kana form", () => {
    const resolved = resolveLexeme({ surface: "読む", base: "読む", reading: null }, [YOMU], [vocab("v-yomu", "読む", "よむ", "đọc")]);
    expect(resolved).toMatchObject({ vocabId: "v-yomu", curatedVi: "đọc" });
  });

  it("resolves with vocabId and curatedVi null when the caller passes no vocab rows (Ask Korume)", () => {
    expect(resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [HITO])).toMatchObject({ vocabId: null, curatedVi: null });
  });

  it("joins the row of the kana form the context confirmed, never the entry's first one (spec §1.5, §1.7)", () => {
    const kyou = [entry(8200, ["今日"], ["きょう", "こんにち"], "today")];
    const kyouRows = [vocab("v-kyou", "今日", "きょう", "hôm nay"), vocab("v-konnichi", "今日", "こんにち", "ngày nay")];
    expect(resolveLexeme({ surface: "今日", base: "今日", reading: "コンニチ" }, kyou, kyouRows))
      .toMatchObject({ vocabId: "v-konnichi", curatedVi: "ngày nay" });
    const iku = [entry(8300, ["行く"], ["ゆく", "いく"], "to go")];
    const ikuRows = [vocab("v-yuku", "行く", "ゆく", "đi (văn)"), vocab("v-iku", "行く", "いく", "đi")];
    expect(resolveLexeme({ surface: "行っ", base: "行く", reading: "イッ" }, iku, ikuRows)?.vocabId).toBe("v-iku");
  });

  it("normalises both readings to hiragana before joining (spec §1.7)", () => {
    // A vocab row stored in katakana still joins the hiragana entry reading.
    expect(resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [HITO], [vocab("v-hito", "人", "ヒト", "người")])?.vocabId)
      .toBe("v-hito");
    // A loanword's katakana entry reading still joins a hiragana vocab row.
    const terebi = entry(8600, [], ["テレビ"], "television");
    expect(resolveLexeme({ surface: "テレビ", base: "テレビ", reading: "テレビ" }, [terebi], [vocab("v-terebi", "テレビ", "てれび", "ti vi")])?.vocabId)
      .toBe("v-terebi");
  });
});

describe("resolveLexeme — candidate selection (spec §1.3)", () => {
  it("tries the base form first and falls back to the surface form only when the base has no entry", () => {
    const yoi = entry(8500, ["良い"], ["よい", "いい"], "good");
    const yoku = entry(8400, ["良く"], ["よく"], "often");
    const token = { surface: "良く", base: "良い", reading: "ヨク" };
    expect(resolveLexeme(token, [yoku])?.matches[0]).toMatchObject({ entSeq: 8400, headword: "良く", reading: "よく" });
    // The surface entry matches the reading exactly, yet the base entry still wins.
    expect(resolveLexeme(token, [yoku, yoi])?.matches[0]?.entSeq).toBe(8500);
  });

  it("ranks a written-form candidate above a reading-only one before commonness and ent_seq", () => {
    const readingOnly = entry(8700, [], ["ネコ"], "reading-only entry", true);
    const written = entry(8800, ["猫", "ネコ"], ["ねこ"], "written entry", false);
    const resolved = resolveLexeme({ surface: "ネコ", base: "ネコ", reading: "ネコ" }, [readingOnly, written]);
    expect(resolved?.matches.map((match) => match.entSeq)).toEqual([8800, 8700]);
  });

  it("returns at most three matches, best first", () => {
    const homographs = ["橋", "箸", "端", "嘴", "梯"].map((kanji, index) => entry(1000 + index, [kanji], ["はし"], kanji));
    const resolved = resolveLexeme({ surface: "はし", base: "はし", reading: "ハシ" }, homographs);
    expect(resolved?.matches.map((match) => match.entSeq)).toEqual([1000, 1001, 1002]);
  });
});

describe("eligibility (spec §1.6)", () => {
  const t = (pos: string, posDetail1: string | null, base: string) => ({ pos, posDetail1, base });

  it("keeps ん, the dependent いる and しまう out of automatic lookup and out of lesson vocabulary", () => {
    for (const token of [t("名詞", "非自立", "ん"), t("動詞", "非自立", "いる"), t("動詞", "非自立", "しまう")]) {
      expect(isAutomaticLookupEligible(token)).toBe(false);
      expect(isLessonVocabularyEligible(token)).toBe(false);
    }
  });

  it("keeps a useful dependent noun (こと) in the popup but out of the lists", () => {
    expect(isAutomaticLookupEligible(t("名詞", "非自立", "こと"))).toBe(true);
    expect(isLessonVocabularyEligible(t("名詞", "非自立", "こと"))).toBe(false);
  });

  it("keeps suffixes and numbers in the popup (アメリカ人's 人 is right there) but out of the lists", () => {
    for (const token of [t("名詞", "接尾", "人"), t("名詞", "数", "三")]) {
      expect(isAutomaticLookupEligible(token)).toBe(true);
      expect(isLessonVocabularyEligible(token)).toBe(false);
    }
  });

  it("lists ordinary content words and never particles or auxiliaries", () => {
    expect(isLessonVocabularyEligible(t("名詞", "一般", "人"))).toBe(true);
    expect(isLessonVocabularyEligible(t("名詞", "形容動詞語幹", "苦手"))).toBe(true);
    expect(isLessonVocabularyEligible(t("動詞", "自立", "話す"))).toBe(true);
    expect(isAutomaticLookupEligible(t("助詞", "格助詞", "が"))).toBe(false);
    expect(isAutomaticLookupEligible(t("助動詞", null, "です"))).toBe(false);
  });
});
