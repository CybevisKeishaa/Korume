const SINGLE_KANJI = /^\p{Script=Han}$/u;

/** A URL segment → exactly one kanji code point (non-BMP included), or null. */
export function parseKanjiLiteral(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep the raw segment; the pattern below rejects anything malformed
  }
  return SINGLE_KANJI.test(decoded) ? decoded : null;
}
