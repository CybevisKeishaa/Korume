/**
 * Furigana assembly: tokenize with kuromoji, then attach a hiragana reading
 * to any segment whose surface form contains kanji. Feeds adaptive furigana
 * (CLAUDE.md §5.4) and the transcript store's `furigana_json`.
 */
import { tokenize } from "./tokenizer";
import type { FuriganaSegment } from "./types";

// Katakana letters (full block, incl. small kana) start at U+30A1 and hiragana
// at U+3041 — a fixed offset of 0x60 apart. The prolonged sound mark U+30FC
// ("ー") falls outside this range and is intentionally left unconverted, since
// it is written identically in hiragana text.
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const HIRAGANA_OFFSET = 0x60;

/** Convert a katakana string to hiragana. Non-katakana characters pass through unchanged. */
export function katakanaToHiragana(input: string): string {
  let result = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= KATAKANA_START && code <= KATAKANA_END) {
      result += String.fromCodePoint(code - HIRAGANA_OFFSET);
    } else {
      result += ch;
    }
  }
  return result;
}

// CJK Unified Ideographs + Extension A — covers standard joyo/jinmeiyo kanji.
const KANJI_START = 0x4e00;
const KANJI_END = 0x9fff;
const KANJI_EXT_A_START = 0x3400;
const KANJI_EXT_A_END = 0x4dbf;

function containsKanji(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const isKanji =
      (code >= KANJI_START && code <= KANJI_END) || (code >= KANJI_EXT_A_START && code <= KANJI_EXT_A_END);
    if (isKanji) {
      return true;
    }
  }
  return false;
}

/**
 * Tokenize `text` and return furigana segments: kanji-bearing segments get a
 * hiragana `reading`, everything else (kana, punctuation, unknown tokens
 * without a reading) is returned as text only.
 */
export async function toFurigana(text: string): Promise<FuriganaSegment[]> {
  const tokens = await tokenize(text);
  return tokens.map((token): FuriganaSegment => {
    if (containsKanji(token.surface) && token.reading) {
      return { text: token.surface, reading: katakanaToHiragana(token.reading) };
    }
    return { text: token.surface };
  });
}
