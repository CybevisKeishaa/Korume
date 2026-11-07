import { readingKey } from "@/lib/dictionary/import/hvdic";
import { viMeaning } from "@/lib/dictionary/vi-meaning";

export const KANJI_SEARCH_LIMIT = 24;

export type KanjiSearchMode = "chars" | "reading" | "text";

/** The `dict_kanji` columns the search reads, one row per kanji of the active snapshot. */
export interface KanjiSearchRow {
  literal: string;
  onReadings: string[];
  kunReadings: string[];
  meaningsEn: string[];
  viReadings: string[];
  viMeanings: string[];
  freq: number | null;
  strokeCount: number;
}

export interface KanjiSearchResult {
  literal: string;
  hanViet: string[];
  meaningVi: string | null;
  meaningEn: string;
}

export interface KanjiSearchResponse {
  query: string;
  mode: KanjiSearchMode;
  results: KanjiSearchResult[];
}

export type KanjiQuery =
  | { mode: "chars"; chars: string[] }
  | { mode: "reading"; kana: string }
  | { mode: "text"; text: string };

const HAN = /\p{Script=Han}/u;
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー・.\-\s]+$/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const WORDISH = /[\p{L}\p{N}]/u;

/** Katakana → hiragana (ァ..ヶ sit 0x60 above ぁ..ゖ). */
const toHiragana = (kana: string) => kana.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
/** A dictionary reading as typed: kun okurigana dots and affix dashes out (た.べる → たべる, -び → び), one kana script. */
const readingForm = (reading: string) => toHiragana(reading.replace(/[.\-・\s]/g, ""));
/** No marks at all, đ as d: what a learner types without a Vietnamese keyboard. */
const bare = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").toLowerCase();

/**
 * A query → what it searches. Any Han character: those kanji (a typed word maps to its kanji; kana around them is
 * okurigana). Only kana: readings. Anything else: Hán Việt and meanings. NFKC first, so full- and half-width input folds.
 */
export function classifyKanjiQuery(raw: string): KanjiQuery {
  const query = raw.normalize("NFKC").trim();
  const chars = [...new Set([...query].filter((c) => HAN.test(c)))];
  if (chars.length > 0) return { mode: "chars", chars };
  if (KANA_ONLY.test(query) && KANA.test(query)) return { mode: "reading", kana: readingForm(query) };
  return { mode: "text", text: query.toLowerCase() };
}

interface IndexEntry {
  row: KanjiSearchRow;
  readings: string[];
  hanVietKeys: string[];
  hanVietBare: string[];
  /** Vietnamese glosses, one per `;`/`,` piece, lower-cased. */
  glosses: string[];
  meaningsEn: string[];
}

export interface KanjiSearchIndex {
  entries: IndexEntry[];
  byLiteral: Map<string, IndexEntry>;
}

const pieces = (texts: string[]) => texts.flatMap((text) => text.split(/[;,]/)).map((text) => text.normalize("NFC").trim().toLowerCase()).filter(Boolean);

export function buildKanjiSearchIndex(rows: KanjiSearchRow[]): KanjiSearchIndex {
  const entries = rows.map((row) => ({
    row,
    readings: [...row.onReadings, ...row.kunReadings].map(readingForm),
    hanVietKeys: row.viReadings.map(readingKey),
    hanVietBare: row.viReadings.map(bare),
    glosses: pieces(row.viMeanings),
    meaningsEn: row.meaningsEn.map((meaning) => meaning.toLowerCase()),
  }));
  return { entries, byLiteral: new Map(entries.map((entry) => [entry.row.literal, entry])) };
}

/** 0 = exact, 1 = partial, null = no match; the best of several. */
type Tier = 0 | 1 | null;
const best = (...tiers: Tier[]): Tier => tiers.reduce<Tier>((a, b) => (a === null ? b : b === null ? a : (Math.min(a, b) as 0 | 1)), null);

function wordTier(haystacks: string[], needle: string, word: RegExp): Tier {
  if (haystacks.includes(needle)) return 0;
  return haystacks.some((text) => word.test(text)) ? 1 : null;
}

function textTier(entry: IndexEntry, curated: string[], text: string, key: string, word: RegExp, ascii: boolean): Tier {
  return best(
    entry.hanVietKeys.includes(key) ? 0 : ascii && entry.hanVietBare.includes(text) ? 1 : null,
    wordTier(entry.glosses, text, word),
    wordTier(curated, text, word),
    wordTier(entry.meaningsEn, text, word),
  );
}

const readingTier = (entry: IndexEntry, kana: string): Tier =>
  entry.readings.includes(kana) ? 0 : entry.readings.some((reading) => reading.startsWith(kana)) ? 1 : null;

function result({ row }: IndexEntry, curated: ReadonlyMap<string, string>): KanjiSearchResult {
  return {
    literal: row.literal,
    hanViet: row.viReadings,
    meaningVi: viMeaning(curated.get(row.literal), row.viMeanings).meaningVi,
    meaningEn: row.meaningsEn.slice(0, 3).join(", "),
  };
}

/**
 * The kanji search (port-kanji Task 12). `curated` is `kanji.meaning_vi` by literal (K16: shown before the imported
 * gloss, and searched too). Order: exact before partial, then frequency (none last), stroke count, code point.
 * ponytail: a linear scan of the snapshot (~13k rows) per query, a few ms; an index table if the snapshot grows 10×.
 */
export function searchKanji(index: KanjiSearchIndex, curated: ReadonlyMap<string, string>, raw: string): KanjiSearchResponse {
  const query = raw.trim();
  const parsed = classifyKanjiQuery(query);
  if (parsed.mode === "chars") {
    const hits = parsed.chars.flatMap((c) => index.byLiteral.get(c) ?? []).slice(0, KANJI_SEARCH_LIMIT);
    return { query, mode: "chars", results: hits.map((entry) => result(entry, curated)) };
  }

  // Punctuation alone would match everything as a "word"; it is no query.
  if (parsed.mode === "text" && !WORDISH.test(parsed.text)) return { query, mode: "text", results: [] };
  let tierOf: (entry: IndexEntry) => Tier;
  if (parsed.mode === "reading") {
    tierOf = (entry) => readingTier(entry, parsed.kana);
  } else {
    const escaped = parsed.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const word = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "u");
    const ascii = /^[\x20-\x7e]+$/.test(parsed.text);
    const key = readingKey(parsed.text);
    const curatedPieces = new Map([...curated].map(([literal, meaning]) => [literal, pieces([meaning])]));
    tierOf = (entry) => textTier(entry, curatedPieces.get(entry.row.literal) ?? [], parsed.text, key, word, ascii);
  }

  const hits: { entry: IndexEntry; tier: 0 | 1 }[] = [];
  for (const entry of index.entries) {
    const tier = tierOf(entry);
    if (tier !== null) hits.push({ entry, tier });
  }
  hits.sort((a, b) =>
    a.tier - b.tier ||
    (a.entry.row.freq ?? Infinity) - (b.entry.row.freq ?? Infinity) ||
    a.entry.row.strokeCount - b.entry.row.strokeCount ||
    (a.entry.row.literal.codePointAt(0) ?? 0) - (b.entry.row.literal.codePointAt(0) ?? 0),
  );
  return { query, mode: parsed.mode, results: hits.slice(0, KANJI_SEARCH_LIMIT).map(({ entry }) => result(entry, curated)) };
}
