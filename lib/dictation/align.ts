export type AlignOp =
  | { type: "match" | "wrong"; refIndex: number; hypIndex: number }
  | { type: "missing"; refIndex: number }
  | { type: "extra"; hypIndex: number };

/** Levenshtein alignment; backtrace ties prefer match > substitution > deletion > insertion. */
export function alignSequences(ref: readonly string[], hyp: readonly string[]): AlignOp[] {
  const n = ref.length;
  const m = hyp.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const cell = (i: number, j: number): number => {
    const value = dp[i]?.[j];
    if (value === undefined) throw new RangeError(`dp cell (${i},${j}) out of bounds`);
    return value;
  };
  const setCell = (i: number, j: number, value: number): void => {
    const row = dp[i];
    if (!row) throw new RangeError(`dp row ${i} out of bounds`);
    row[j] = value;
  };
  const char = (chars: readonly string[], index: number): string => {
    const c = chars[index];
    if (c === undefined) throw new RangeError(`character index ${index} out of bounds`);
    return c;
  };

  for (let i = 0; i <= n; i++) setCell(i, 0, i);
  for (let j = 0; j <= m; j++) setCell(0, j, j);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const value = char(ref, i - 1) === char(hyp, j - 1)
        ? cell(i - 1, j - 1)
        : 1 + Math.min(cell(i - 1, j - 1), cell(i - 1, j), cell(i, j - 1));
      setCell(i, j, value);
    }
  }

  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && char(ref, i - 1) === char(hyp, j - 1) && cell(i, j) === cell(i - 1, j - 1)) {
      ops.push({ type: "match", refIndex: i - 1, hypIndex: j - 1 });
      i--;
      j--;
    } else if (i > 0 && j > 0 && cell(i, j) === cell(i - 1, j - 1) + 1) {
      ops.push({ type: "wrong", refIndex: i - 1, hypIndex: j - 1 });
      i--;
      j--;
    } else if (i > 0 && cell(i, j) === cell(i - 1, j) + 1) {
      ops.push({ type: "missing", refIndex: i - 1 });
      i--;
    } else {
      ops.push({ type: "extra", hypIndex: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}
