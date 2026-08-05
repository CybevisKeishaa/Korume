import { describe, expect, it } from "vitest";
import { katakanaToHiragana, toFurigana } from "./furigana";

// kuromoji dictionary build is a real (slow-ish) disk load; give it room.
// Raised 20s -> 60s on 2026-08-05: this load measures 16-20s under full-suite
// parallel contention, so 20s sat right on the edge and flaked. It is a
// one-time dictionary read, not a behavioural assertion — extra headroom costs
// nothing when the test passes (it runs in ~400ms in isolation).
const KUROMOJI_TIMEOUT = 60000;

describe("katakanaToHiragana", () => {
  it("converts a full katakana word", () => {
    expect(katakanaToHiragana("ニホンゴ")).toBe("にほんご");
  });

  it("converts katakana including small kana", () => {
    expect(katakanaToHiragana("キャラクター")).toBe("きゃらくたー");
  });

  it("leaves the prolonged sound mark (ー) unconverted", () => {
    expect(katakanaToHiragana("コーヒー")).toBe("こーひー");
  });

  it("leaves non-katakana characters (hiragana, kanji, romaji, punctuation) unchanged", () => {
    expect(katakanaToHiragana("abc123")).toBe("abc123");
    expect(katakanaToHiragana("日本語")).toBe("日本語");
    expect(katakanaToHiragana("こんにちは")).toBe("こんにちは");
    expect(katakanaToHiragana("。、！")).toBe("。、！");
  });

  it("handles mixed katakana/non-katakana strings, converting only the katakana runs", () => {
    expect(katakanaToHiragana("私はニホンゴを勉強する")).toBe("私はにほんごを勉強する");
  });

  it("handles an empty string", () => {
    expect(katakanaToHiragana("")).toBe("");
  });
});

describe(
  "toFurigana",
  () => {
    it("attaches hiragana readings only to kanji-bearing segments", async () => {
      const segments = await toFurigana("日本語を勉強する");

      const withKanji = segments.filter((s) => /[一-鿿]/.test(s.text));
      for (const seg of withKanji) {
        expect(seg.reading).toBeTruthy();
      }

      const kanaOnly = segments.filter((s) => !/[一-鿿]/.test(s.text));
      for (const seg of kanaOnly) {
        expect(seg.reading).toBeUndefined();
      }

      // Reconstructing all segment text must reproduce the original sentence.
      expect(segments.map((s) => s.text).join("")).toBe("日本語を勉強する");
    }, KUROMOJI_TIMEOUT);

    it("gives 日本語 the reading にほんご", async () => {
      const segments = await toFurigana("日本語を勉強する");
      const nihongo = segments.find((s) => s.text === "日本語");
      expect(nihongo).toBeDefined();
      expect(nihongo?.reading).toBe("にほんご");
    }, KUROMOJI_TIMEOUT);

    it("gives 勉強 the reading べんきょう and leaves を/する without a reading", async () => {
      const segments = await toFurigana("日本語を勉強する");
      const benkyou = segments.find((s) => s.text === "勉強");
      expect(benkyou?.reading).toBe("べんきょう");

      const wo = segments.find((s) => s.text === "を");
      expect(wo).toBeDefined();
      expect(wo?.reading).toBeUndefined();

      const suru = segments.find((s) => s.text === "する");
      expect(suru).toBeDefined();
      expect(suru?.reading).toBeUndefined();
    }, KUROMOJI_TIMEOUT);

    it("leaves punctuation-only segments without a reading", async () => {
      const segments = await toFurigana("今日は。");
      const punctuation = segments.find((s) => s.text === "。");
      expect(punctuation).toBeDefined();
      expect(punctuation?.reading).toBeUndefined();
    }, KUROMOJI_TIMEOUT);

    it("is deterministic across repeated calls on the same sentence", async () => {
      const a = await toFurigana("日本語を勉強する");
      const b = await toFurigana("日本語を勉強する");
      expect(a).toEqual(b);
    }, KUROMOJI_TIMEOUT);
  },
);
