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
