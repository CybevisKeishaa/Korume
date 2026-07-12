import type { DictationDiff, DictationResult } from "./types";
import { normalizeJa } from "./normalize";

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
  const m = usr.length;

  // dp[i][j] = min edit distance between ref[0..i) and usr[0..j). Rows are
  // built to exactly n+1 x m+1 and only ever indexed within [0, n] x [0, m],
  // so the `noUncheckedIndexedAccess` `number | undefined` reads below are
  // sound; `cell`/`char` centralize that guarantee in one place instead of
  // scattering non-null assertions through the DP fill and backtrace.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const cell = (i: number, j: number): number => {
    const row = dp[i];
    const value = row?.[j];
    if (value === undefined) throw new RangeError(`dp cell (${i},${j}) out of bounds`);
    return value;
  };
  const setCell = (i: number, j: number, value: number): void => {
    const row = dp[i];
    if (!row) throw new RangeError(`dp row ${i} out of bounds`);
    row[j] = value;
  };
  const char = (chars: string[], index: number): string => {
    const c = chars[index];
    if (c === undefined) throw new RangeError(`character index ${index} out of bounds`);
    return c;
  };

  for (let i = 0; i <= n; i++) setCell(i, 0, i);
  for (let j = 0; j <= m; j++) setCell(0, j, j);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const value =
        char(ref, i - 1) === char(usr, j - 1)
          ? cell(i - 1, j - 1)
          : 1 + Math.min(cell(i - 1, j - 1), cell(i - 1, j), cell(i, j - 1));
      setCell(i, j, value);
    }
  }

  // Backtrace from (n, m) to (0, 0). Preference order match > substitution >
  // deletion > insertion keeps the path stable/deterministic on ties.
  const diffRev: DictationDiff[] = [];
  let i = n;
  let j = m;
  let matched = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && char(ref, i - 1) === char(usr, j - 1) && cell(i, j) === cell(i - 1, j - 1)) {
      diffRev.push({ type: "match", expected: char(ref, i - 1), actual: char(usr, j - 1) });
      matched++;
      i--;
      j--;
    } else if (i > 0 && j > 0 && cell(i, j) === cell(i - 1, j - 1) + 1) {
      diffRev.push({ type: "wrong", expected: char(ref, i - 1), actual: char(usr, j - 1) });
      i--;
      j--;
    } else if (i > 0 && cell(i, j) === cell(i - 1, j) + 1) {
      diffRev.push({ type: "missing", expected: char(ref, i - 1) });
      i--;
    } else {
      diffRev.push({ type: "extra", actual: char(usr, j - 1) });
      j--;
    }
  }
  diffRev.reverse();

  const accuracy = Math.round((matched / n) * 1000) / 10;
  return { accuracy, diff: diffRev };
}
