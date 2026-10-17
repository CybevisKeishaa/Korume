import { alignSequences } from "@/lib/dictation/align";
import type { AssessmentWord } from "./assessment";

export const ALIGN_MIN_COVERAGE = 0.9;
export interface WordSpan {
  start: number;
  end: number;
  accuracy: number | null;
  errorType: AssessmentWord["errorType"];
}

const IGNORED = /[\s\p{P}\p{S}]/u;
const norm = (char: string): string => char.normalize("NFKC");

/** Spans index Array.from(lineText), end exclusive; require ≥90% matching non-punctuation characters. */
export function alignWords(lineText: string, words: readonly AssessmentWord[]): WordSpan[] | null {
  const chars = Array.from(lineText);
  const ref: string[] = [];
  const refOrigin: number[] = [];
  chars.forEach((char, index) => {
    if (IGNORED.test(char)) return;
    for (const piece of Array.from(norm(char))) {
      ref.push(piece);
      refOrigin.push(index);
    }
  });
  const kept = words.filter((word) => word.errorType !== "Insertion");
  const hyp: string[] = [];
  const hypOwner: number[] = [];
  kept.forEach((word, owner) => {
    for (const piece of Array.from(norm(word.word))) {
      if (IGNORED.test(piece)) continue;
      hyp.push(piece);
      hypOwner.push(owner);
    }
  });
  if (ref.length === 0) return null;

  const spans: WordSpan[] = [];
  let lastOwner: number | undefined;
  let aligned = 0;
  for (const op of alignSequences(ref, hyp)) {
    if (op.type !== "match" && op.type !== "wrong") continue;
    if (op.type === "match") aligned++;
    const owner = hypOwner[op.hypIndex];
    const origin = refOrigin[op.refIndex];
    const word = owner === undefined ? undefined : kept[owner];
    if (owner === undefined || origin === undefined || word === undefined) {
      throw new RangeError("alignment index out of bounds");
    }
    const previous = spans.at(-1);
    // Split at unaligned characters/punctuation so the UI never colours them by spanning a gap.
    if (previous && lastOwner === owner && origin <= previous.end) {
      previous.end = Math.max(previous.end, origin + 1);
    } else {
      spans.push({ start: origin, end: origin + 1, accuracy: word.accuracy, errorType: word.errorType });
    }
    lastOwner = owner;
  }
  if (aligned / ref.length < ALIGN_MIN_COVERAGE) return null;
  return spans;
}
