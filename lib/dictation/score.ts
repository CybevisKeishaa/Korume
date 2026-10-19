import type { DictationDiff, DictationResult } from "./types";
import { normalizeJa } from "./normalize";
import { alignSequences } from "./align";

/**
 * Score a user's dictation attempt against the reference transcript line.
 *
 * Pure and deterministic: no I/O, no randomness. Both strings are normalized
 * first (NFKC + whitespace stripped, see `normalizeJa`) so full/half-width
 * variants and spacing never affect the result. Alignment is a classic
 * Levenshtein edit-distance DP with a backtrace that classifies each
 * character as match / wrong (substitution) / missing (deletion from the
 * reference) / extra (insertion in the input).
 *
 * `accuracy = matched characters / reference length * 100`, rounded to one
 * decimal place. An empty reference is a guarded special case (0, since
 * there is nothing to match against).
 */
export function scoreDictation(reference: string, input: string): DictationResult {
  const ref = Array.from(normalizeJa(reference));
  const usr = Array.from(normalizeJa(input));

  if (ref.length === 0) {
    const diff: DictationDiff[] = usr.map((actual) => ({ type: "extra" as const, actual }));
    return { accuracy: 0, diff };
  }

  const n = ref.length;
  const char = (chars: string[], index: number): string => {
    const value = chars[index];
    if (value === undefined) throw new RangeError(`character index ${index} out of bounds`);
    return value;
  };
  const ops = alignSequences(ref, usr);
  let matched = 0;
  const diff: DictationDiff[] = ops.map((op) => {
    if (op.type === "match") {
      matched++;
      return { type: "match", expected: char(ref, op.refIndex), actual: char(usr, op.hypIndex) };
    }
    if (op.type === "wrong") return { type: "wrong", expected: char(ref, op.refIndex), actual: char(usr, op.hypIndex) };
    if (op.type === "missing") return { type: "missing", expected: char(ref, op.refIndex) };
    return { type: "extra", actual: char(usr, op.hypIndex) };
  });

  const accuracy = Math.round((matched / n) * 1000) / 10;
  return { accuracy, diff };
}
