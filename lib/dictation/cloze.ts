import type { Token } from "@/lib/japanese/types";
import { katakanaToHiragana } from "@/lib/japanese/kana";
import { chunkUnits, type Range } from "./listening-score";
import { normalizeJa } from "./normalize";

export const CURRENT_CLOZE_SELECTOR = 1;
/** Cloze rows record the tokenizer pipeline of `lineTokens`, which is chunker v2's. */
export const CLOZE_TOKENS_CHUNKER = 2;

const JA = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const EXCLUDED_NOUN_DETAIL = new Set(["数", "代名詞", "非自立", "接尾"]);

// Cloze selector v1 (with `lineTokens`): never edit once attempts reference it; add v2 instead.
/** Spec §3.4: nouns (minus 数/代名詞/非自立/接尾 and 1-char kana) and dictionary-form verbs/adjectives. */
export function clozeCandidates(tokens: Token[]): number[] {
  const out: number[] = [];
  tokens.forEach((t, i) => {
    if (!JA.test(t.surface)) return;
    if (t.pos === "名詞") {
      if (t.posDetail1 && EXCLUDED_NOUN_DETAIL.has(t.posDetail1)) return;
      if (KANA_ONLY.test(t.surface) && Array.from(t.surface).length === 1) return;
      out.push(i);
    } else if ((t.pos === "動詞" || t.pos === "形容詞") && t.surface === t.base) {
      out.push(i);
    }
  });
  return out;
}

/** Up to `max` blanks: unknown first, then longer surface, then earlier; never adjacent. Ascending indices. */
export function selectBlanks(tokens: Token[], known: Set<string>, max = 3): number[] {
  const isKnown = (t: Token) =>
    known.has(t.base) || (t.reading !== null && known.has(katakanaToHiragana(t.reading)));
  const ranked = clozeCandidates(tokens)
    .map((i) => ({ i, known: Number(isKnown(tokens[i]!)), len: Array.from(tokens[i]!.surface).length }))
    .sort((a, b) => a.known - b.known || b.len - a.len || a.i - b.i);
  const picked: number[] = [];
  for (const { i } of ranked) {
    if (picked.length === max) break;
    if (picked.some((p) => Math.abs(p - i) === 1)) continue;
    picked.push(i);
  }
  return picked.sort((a, b) => a - b);
}

/** Chế độ dễ's wrong chips per blank (spec §3.5, owner 2026-11-03). */
export const DISTRACTORS_PER_BLANK = 2;

const script = (s: string) =>
  /\p{Script=Han}/u.test(s) ? "kanji" : /^[\p{Script=Katakana}ー]+$/u.test(s) ? "katakana" : "kana";

/**
 * Chế độ dễ's distractors (spec §3.5): for each blank, up to `per` cloze candidates of the lesson's nearby lines
 * (`pool`, nearest first) with the blank's part of speech — same script, then same noun kind, then closest length,
 * then nearest line first. Never a word, lemma or reading of this line, never one reading twice. Deterministic for a
 * line and its pool; UI only, so the selector version and stored attempts do not depend on it.
 */
export function pickDistractors(tokens: Token[], blanks: number[], pool: Token[][], per = DISTRACTORS_PER_BLANK): string[] {
  const reading = (t: Token) => katakanaToHiragana(t.reading ?? t.surface);
  const taken = new Set(tokens.flatMap((t) => [t.surface, t.base, reading(t)]));
  const candidates: { token: Token; distance: number }[] = [];
  pool.forEach((line, distance) => {
    for (const i of clozeCandidates(line)) {
      const t = line[i]!;
      if (taken.has(t.surface) || taken.has(t.base) || taken.has(reading(t))) continue;
      taken.add(t.surface).add(reading(t));
      candidates.push({ token: t, distance });
    }
  });
  const used = new Set<Token>();
  const out: string[] = [];
  for (const b of blanks) {
    const blank = tokens[b]!;
    const len = Array.from(blank.surface).length;
    const key = ({ token, distance }: { token: Token; distance: number }) => [
      Number(script(token.surface) !== script(blank.surface)),
      Number(token.posDetail1 !== blank.posDetail1),
      Math.abs(Array.from(token.surface).length - len),
      distance,
    ];
    const ranked = candidates
      .filter((c) => c.token.pos === blank.pos && !used.has(c.token))
      .map((c) => ({ c, k: key(c) }))
      .sort((x, y) => x.k.reduce((d, v, i) => d || v - y.k[i]!, 0));
    for (const { c } of ranked.slice(0, per)) {
      used.add(c.token);
      out.push(c.token.surface);
    }
  }
  return out;
}

export type ClozeBlank = { token: number; surface: string; reading: string };

/** Each token's code-point range over the normalised line `base`, or `null` when the tokens do not cover it (no blanks). */
export function tokenRanges(tokens: Token[], base: string): Range[] | null {
  const surfaces = tokens.map((t) => t.surface);
  return surfaces.join("") === base ? chunkUnits(surfaces) : null;
}

/** The blank of token `i`; a reading-less token (some 固有名詞) reads as written. */
export function clozeBlank(tokens: Token[], i: number): ClozeBlank {
  const t = tokens[i]!;
  return { token: i, surface: t.surface, reading: katakanaToHiragana(t.reading ?? t.surface) };
}

export const graphemes = (s: string) => Array.from(new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(s)).length;

export function scoreCloze(
  blanks: ClozeBlank[],
  answers: string[],
  hinted: number[][],
): {
  score: number;
  blanks: { correct: boolean; hinted: number }[];
  metrics: { recall: number; slots: { correct: number; total: number } };
} {
  const results = blanks.map((b, i) => {
    const h = hinted[i]?.length ?? 0;
    // Kana folds to hiragana on both sides: a learner may finish a hinted コーヒー in katakana, or type ニホン for 日本.
    const a = normalizeJa(answers[i] ?? "");
    const kana = katakanaToHiragana(a);
    const reading = katakanaToHiragana(normalizeJa(b.reading));
    const correct = h > 0 ? kana === reading : a === normalizeJa(b.surface) || kana === reading;
    return { correct, hinted: h, len: graphemes(b.reading) };
  });
  const mean =
    results.length === 0
      ? 0
      : results.reduce((s, r) => s + (r.correct ? (r.len - r.hinted) / r.len : 0), 0) / results.length;
  const score = Math.round(mean * 1000) / 10;
  return {
    score,
    blanks: results.map(({ correct, hinted: h }) => ({ correct, hinted: h })),
    metrics: {
      recall: score,
      slots: { correct: results.filter((r) => r.correct && r.hinted === 0).length, total: results.length },
    },
  };
}
