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
const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

function normalizedCharacters(text: string): { char: string; start: number; end: number }[] {
  const result: { char: string; start: number; end: number }[] = [];
  let end = 0;
  for (const { segment } of segmenter.segment(text)) {
    const start = end;
    end += Array.from(segment).length;
    if (IGNORED.test(segment)) continue;
    for (const char of Array.from(segment.normalize("NFKC"))) {
      if (!IGNORED.test(char)) result.push({ char, start, end });
    }
  }
  return result;
}

/** Spans index Array.from(lineText), end exclusive; require ≥90% matching non-punctuation characters. */
export function alignWords(lineText: string, words: readonly AssessmentWord[]): WordSpan[] | null {
  const refOrigin = normalizedCharacters(lineText);
  const ref = refOrigin.map((part) => part.char);
  const kept = words.filter((word) => word.errorType !== "Insertion");
  const rawOwners = kept.flatMap((word, owner) => Array.from(word.word, () => owner));
  const hypParts = normalizedCharacters(kept.map((word) => word.word).join(""));
  const hyp = hypParts.map((part) => part.char);
  // A mark split into the next Azure word composes with its base and keeps the base word's score.
  const hypOwner = hypParts.map((part) => rawOwners[part.start]);
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
    if (previous && lastOwner === owner && origin.start <= previous.end) {
      previous.end = Math.max(previous.end, origin.end);
    } else {
      spans.push({ start: origin.start, end: origin.end, accuracy: word.accuracy, errorType: word.errorType });
    }
    lastOwner = owner;
  }
  if (aligned / ref.length < ALIGN_MIN_COVERAGE) return null;
  return spans;
}
