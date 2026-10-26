import { alignSequences } from "./align";
import { displayRange } from "./display";
import { normalizeJa } from "./normalize";

/** Code-point indices into `base`, end exclusive. */
export type Range = { start: number; end: number };

/** The spec's set plus the NFKC forms `normalizeJa` produces. */
export const PUNCTUATION = /[。、！？「」『』（）…・!?()"\s.,]/u;

/** Every op but `extra` points at a reference character; `display` is its raw text (owner 2026-10-21, P13). */
export type ListeningDiffOp =
  | { type: "extra"; actual: string }
  | { type: "match" | "wrong"; expected: string; actual: string; display: string }
  | { type: "missing" | "hinted"; expected: string; display: string };

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
  /** The raw text of each chunk, same length and order as `chunks`. */
  display: string[];
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

/**
 * v2 Word Bank (WP spec §3.2-§3.4): a piece is correct when it lies on a longest common subsequence of the
 * answer and the reference. The hinted prefix (answer slots `0..hintedCount-1`) leaves both sides, is never
 * correct and never scores. Ties walk forward and skip the answer side first, so the result is stable.
 */
export function scoreWordBankLcs(
  chunks: string[],
  order: number[],
  hintedCount: number,
): ReturnType<typeof scoreWordBank> {
  const n = chunks.length;
  const a = order.slice(hintedCount).map((i) => chunks[i]);
  const r = chunks.slice(hintedCount);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(r.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = r.length - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === r[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const onLcs = new Array<boolean>(a.length).fill(false);
  for (let i = 0, j = 0; i < a.length && j < r.length; ) {
    if (a[i] === r[j] && dp[i]![j] === dp[i + 1]![j + 1]! + 1) {
      onLcs[i++] = true;
      j++;
    }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  const slots = order.map((chunkIndex, p) => ({
    chunkIndex,
    correct: p >= hintedCount && onLcs[p - hintedCount] === true,
    hinted: p < hintedCount,
  }));
  const correct = slots.filter((s) => s.correct).length;
  const score = n === 0 ? 0 : pct(correct, n);
  return { score, slots, metrics: { recall: score, slots: { correct, total: n } } };
}

export function scoreTyping(
  base: string,
  input: string,
  hintedRanges: Range[],
  grammar: Range[],
  display: string[] | null = null,
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
    const at = ref.map[op.refIndex] ?? 0;
    const shown = displayRange(display, base, { start: at, end: at + 1 });
    if (hintedRef.has(op.refIndex)) return { type: "hinted", expected, display: shown };
    if (op.type === "match") matched.add(op.refIndex);
    return op.type === "missing"
      ? { type: "missing", expected, display: shown }
      : { type: op.type, expected, actual: hyp[op.hypIndex] ?? "", display: shown };
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
