import { toRomaji as wanakanaToRomaji } from "wanakana";
import type { Token } from "./types";

/** Katakana to hiragana by code shift (stdlib; ー and non-kana pass through). */
export function toHiraganaReading(katakana: string): string {
  return katakana.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Hepburn via wanakana (ん before a vowel or y becomes n' natively); ー repeats the vowel. */
export function toRomaji(katakanaOrHiragana: string): string {
  return wanakanaToRomaji(toHiraganaReading(katakanaOrHiragana)).replace(
    /([aiueo])-/g,
    "$1$1", // ー repeats the vowel (no macrons)
  );
}

const PARTICLE: Record<string, string> = { は: "wa", へ: "e", を: "o" };

/** Tokens joined with spaces; は/へ/を as particles read wa/e/o; punctuation and reading-less tokens kept as written. */
export function lineRomaji(tokens: Token[]): string {
  return tokens
    .map((t) => (t.pos === "助詞" && PARTICLE[t.surface]) || (t.reading ? toRomaji(t.reading) : t.surface))
    .join(" ");
}
