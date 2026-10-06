import { katakanaToHiragana } from "@/lib/japanese/kana";
import type { DictionaryMatch } from "./types";

/**
 * Spec §1: one lexical resolution for every caller — the Shadowing popup, lesson vocabulary, Summary candidates and
 * hydration, Ask Korume and Print. Pure: the callers read the database in batches and pass the rows in.
 */
export const LEXICAL_RESOLVER_VERSION = 2;

export interface EntryRow {
  ent_seq: number;
  kanji_forms: string[];
  kana_forms: string[];
  senses: { gloss?: string[] }[];
  common: boolean;
  jlpt: number | null;
}

export interface VocabRow {
  id: string;
  word: string;
  reading: string | null;
  meaning_vi: string | null;
}

export interface ResolverToken {
  surface: string;
  base: string;
  /** Katakana as kuromoji reports it, or null (unknown word, or a caller with no sentence context). */
  reading: string | null;
}

export interface EligibilityToken {
  pos: string;
  posDetail1: string | null;
  base: string;
}

export type ReadingMatch = "exact" | "stem" | "fallback";

export interface ResolvedLexeme {
  /** At most three, best first; `matches[0]` is the resolution. */
  matches: DictionaryMatch[];
  readingMatch: ReadingMatch;
  vocabId: string | null;
  curatedVi: string | null;
}

const ENTRIES_PER_TOKEN = 3;
const CONTENT_POS = new Set(["名詞", "動詞", "形容詞", "副詞", "連体詞", "感動詞", "接続詞"]);
/** Spec §1.6: never in a lesson's word list. */
const NOT_LISTED = new Set(["非自立", "接尾", "数"]);
/** Spec §1.6: dependent uses whose dictionary entry misleads (ん "yes; yeah", しまう "to put away"). */
const NO_LOOKUP = [
  { pos: "名詞", posDetail1: "非自立", base: "ん" },
  { pos: "動詞", posDetail1: "非自立", base: "いる" },
  { pos: "動詞", posDetail1: "非自立", base: "しまう" },
];
const QUALITY: Record<ReadingMatch, number> = { exact: 0, stem: 1, fallback: 2 };
const KANA = /[ぁ-ゖァ-ヺー]/;

export function isAutomaticLookupEligible(token: EligibilityToken): boolean {
  return CONTENT_POS.has(token.pos)
    && !NO_LOOKUP.some((rule) => rule.pos === token.pos && rule.posDetail1 === token.posDetail1 && rule.base === token.base);
}

export function isLessonVocabularyEligible(token: EligibilityToken): boolean {
  return CONTENT_POS.has(token.pos) && !(token.posDetail1 !== null && NOT_LISTED.has(token.posDetail1));
}

function trailingKana(text: string): number {
  let count = 0;
  for (let index = text.length - 1; index >= 0 && KANA.test(text[index] ?? ""); index -= 1) count += 1;
  return count;
}

/** Spec §1.4: exact reading, else the stems once each side's own okurigana is cut, else the legacy first kana form. */
function readingOf(entry: EntryRow, token: ResolverToken): { kind: ReadingMatch; kana: string } {
  const fallback = { kind: "fallback" as const, kana: entry.kana_forms[0] ?? "" };
  if (!token.reading) return fallback;
  const reading = katakanaToHiragana(token.reading);
  const exact = entry.kana_forms.find((kana) => katakanaToHiragana(kana) === reading);
  if (exact) return { kind: "exact", kana: exact };
  if (token.surface === token.base) return fallback;
  const stem = reading.slice(0, reading.length - trailingKana(token.surface));
  if (stem === "") return fallback;
  const cut = trailingKana(token.base);
  const hit = entry.kana_forms.find((kana) => {
    const hiragana = katakanaToHiragana(kana);
    return hiragana.slice(0, hiragana.length - cut) === stem;
  });
  return hit ? { kind: "stem", kana: hit } : fallback;
}

function toMatch(entry: EntryRow, form: string, kana: string): DictionaryMatch {
  return {
    entSeq: entry.ent_seq,
    // Owner ruling 2026-10-06: the lesson's own spelling is the display form; JMdict kanji forms are metadata.
    headword: entry.kanji_forms.includes(form) || entry.kana_forms.includes(form) ? form : entry.kanji_forms[0] ?? entry.kana_forms[0] ?? form,
    reading: kana,
    glossEn: (entry.senses[0]?.gloss ?? []).slice(0, 3).join("; "),
    jlpt: entry.jlpt,
  };
}

/**
 * Base form first, then surface. Every candidate carries the form (the headword match); among them: exact reading,
 * stem reading, none — then a written (kanji) match, common words, ent_seq.
 */
export function resolveLexeme(token: ResolverToken, entries: EntryRow[], vocabRows: VocabRow[] = []): ResolvedLexeme | null {
  for (const form of [token.base, token.surface]) {
    const ranked = entries
      .filter((entry) => entry.kanji_forms.includes(form) || entry.kana_forms.includes(form))
      .map((entry) => ({ entry, reading: readingOf(entry, token) }))
      .sort((a, b) =>
        QUALITY[a.reading.kind] - QUALITY[b.reading.kind] ||
        Number(b.entry.kanji_forms.includes(form)) - Number(a.entry.kanji_forms.includes(form)) ||
        Number(b.entry.common) - Number(a.entry.common) ||
        a.entry.ent_seq - b.entry.ent_seq);
    const best = ranked[0];
    if (!best) continue;
    const matches = ranked.slice(0, ENTRIES_PER_TOKEN).map(({ entry, reading }) => toMatch(entry, form, reading.kana));
    // Spec §1.7: a fallback reading of a multi-reading entry is a guess; vocab data never confirms it.
    const unambiguous = best.reading.kind !== "fallback" || best.entry.kana_forms.length === 1;
    const resolved = matches[0];
    const entry0Kanji = best.entry.kanji_forms[0] ?? best.entry.kana_forms[0]; // the canonical spelling a curated row may still use
    // A row written as the matched token form joins too: curated する/する while JMdict's headword is 為る.
    const vocab = unambiguous && resolved
      ? vocabRows.find((row) => (row.word === resolved.headword || row.word === form || row.word === entry0Kanji) && row.reading !== null
        && katakanaToHiragana(row.reading) === katakanaToHiragana(resolved.reading))
      : undefined;
    return { matches, readingMatch: best.reading.kind, vocabId: vocab?.id ?? null, curatedVi: vocab?.meaning_vi?.trim() || null };
  }
  return null;
}

/** Reading-less lookup (Ask Korume's dictionary and exposure tools): today's ranking, unchanged. */
export function entriesFor(base: string, surface: string, entries: EntryRow[]): DictionaryMatch[] {
  return resolveLexeme({ surface, base, reading: null }, entries)?.matches ?? [];
}
