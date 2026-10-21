import { alignSequences } from "./align";
import { normalizeJa } from "./normalize";
import type { DictationDiff } from "./types";

/** Code-point indices into `base`, end exclusive. */
export type Range = { start: number; end: number };

/** The spec's set plus the NFKC forms `normalizeJa` produces. */
export const PUNCTUATION = /[。、！？「」『』（）…・!?()\s.,]/u;

export type ListeningDiffOp = DictationDiff | { type: "hinted"; expected: string };

export interface ListeningMetrics {
  recall: number;
  slots?: { correct: number; total: number };
  kanji?: number;
  grammar?: number;
}

/** `POST /api/dictation/attempt` success payloads (spec §5.4, §5.5). `answer` is the raw `text_jp`. */
export interface ListeningSubmitData {
  kind: "submit";
  score: number;
  /** Word Bank only. */
  slots?: ReturnType<typeof scoreWordBank>["slots"];
  /** Typing only. */
  diff?: ListeningDiffOp[];
  metrics: ListeningMetrics;
  answer: string;
}
export interface ListeningRevealData {
  kind: "reveal";
  answer: string;
  /** Reference-order chunks; `[]` on an unreliable line. */
  chunks: string[];
}

const pct = (num: number, den: number): number => Math.round((num / den) * 1000) / 10;
const HAN = /\p{Script=Han}/u;

/** `chars[i]` is the i-th kept code point; `map[i]` its index in `Array.from(base)`. */
export function stripPunctuation(base: string): { chars: string[]; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  Array.from(base).forEach((c, i) => {
    if (PUNCTUATION.test(c)) return;
    chars.push(c);
    map.push(i);
  });
  return { chars, map };
}

export function chunkUnits(chunks: string[]): Range[] {
  let start = 0;
  return chunks.map((c) => {
    const end = start + Array.from(c).length;
    const range = { start, end };
    start = end;
    return range;
  });
}

/** 4 grapheme clusters per unit (last may be shorter); never splits a cluster. */
export function grapheme4Units(base: string): Range[] {
  const units: Range[] = [];
  let pos = 0;
  let start = 0;
  let count = 0;
  for (const { segment } of new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(base)) {
    pos += Array.from(segment).length;
    if (++count === 4) {
      units.push({ start, end: pos });
      start = pos;
      count = 0;
    }
  }
  if (count > 0) units.push({ start, end: pos });
  return units;
}

export function scoreWordBank(
  chunks: string[],
  order: number[],
  hinted: ReadonlySet<number>,
): {
  score: number;
  slots: { chunkIndex: number; correct: boolean; hinted: boolean }[];
  metrics: ListeningMetrics;
} {
  const slots = chunks.map((expected, i) => ({
    chunkIndex: order[i] ?? -1,
    correct: chunks[order[i] ?? -1] === expected,
    hinted: hinted.has(i),
  }));
  const total = slots.length;
  const scored = slots.filter((s) => s.correct && !s.hinted).length;
  const score = total === 0 ? 0 : pct(scored, total);
  return {
    score,
    slots,
    metrics: { recall: score, slots: { correct: scored, total } },
  };
}

export function scoreTyping(
  base: string,
  input: string,
  hintedRanges: Range[],
  grammar: Range[],
): { score: number; diff: ListeningDiffOp[]; metrics: ListeningMetrics } {
  const ref = stripPunctuation(base);
  const hyp = stripPunctuation(normalizeJa(input)).chars;
  const inRanges = (ranges: Range[], p: number) => ranges.some((r) => p >= r.start && p < r.end);
  const hintedRef = new Set([...ref.chars.keys()].filter((i) => inRanges(hintedRanges, ref.map[i] ?? -1)));

  if (ref.chars.length === 0) {
    return { score: 0, diff: hyp.map((actual) => ({ type: "extra" as const, actual })), metrics: { recall: 0 } };
  }

  const matched = new Set<number>();
  const diff: ListeningDiffOp[] = alignSequences(ref.chars, hyp).map((op) => {
    if (op.type === "extra") return { type: "extra", actual: hyp[op.hypIndex] ?? "" };
    const expected = ref.chars[op.refIndex] ?? "";
    if (hintedRef.has(op.refIndex)) return { type: "hinted", expected };
    if (op.type === "match") matched.add(op.refIndex);
    return op.type === "missing"
      ? { type: "missing", expected }
      : { type: op.type, expected, actual: hyp[op.hypIndex] ?? "" };
  });

  const ratio = (indices: number[]) => pct(indices.filter((i) => matched.has(i)).length, indices.length);
  const all = [...ref.chars.keys()];
  const han = all.filter((i) => HAN.test(ref.chars[i] ?? ""));
  const gram = all.filter((i) => inRanges(grammar, ref.map[i] ?? -1));
  const score = ratio(all);
  const metrics: ListeningMetrics = { recall: score };
  if (han.length > 0) metrics.kanji = ratio(han);
  if (gram.length > 0) metrics.grammar = ratio(gram);
  return { score, diff, metrics };
}
