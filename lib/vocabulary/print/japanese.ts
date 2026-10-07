import { katakanaToHiragana } from "@/lib/japanese/kana";

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

/** Spec W §1.2: one writing cell and one stroke guide per grapheme, never per UTF-16 code unit. */
export function graphemes(text: string): string[] {
  return [...segmenter.segment(text)].map((part) => part.segment);
}

/** Spec W §1.3: 々 is an ideographic iteration mark, so a word containing it is never "kana-only". */
export function hasKanji(form: string): boolean {
  return /[\p{Script=Han}々]/u.test(form);
}

/** Spec W §2: true when writing the reading down IS writing the answer, so self-test must not show it. */
export function readingRevealsTarget(surface: string, reading: string | undefined): boolean {
  if (reading === undefined) return false;
  const normal = (text: string) => katakanaToHiragana(text.normalize("NFKC"));
  return normal(surface) === normal(reading);
}
