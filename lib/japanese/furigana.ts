/**
 * Furigana assembly: tokenize with kuromoji, then attach a hiragana reading
 * to any segment whose surface form contains kanji. Feeds adaptive furigana
 * (CLAUDE.md §5.4) and the transcript store's `furigana_json`.
 */
import { tokenize } from "./tokenizer";
import type { FuriganaSegment } from "./types";

import { katakanaToHiragana } from "./kana";
export { katakanaToHiragana };

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
