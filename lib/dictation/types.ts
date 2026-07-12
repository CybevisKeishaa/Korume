/**
 * One character-level alignment op between a reference transcript line and a
 * user's typed input.
 * - match:   character present and correct in both
 * - wrong:   character present in both but differs (substitution)
 * - missing: character present in the reference but absent from the input (deletion)
 * - extra:   character present in the input but absent from the reference (insertion)
 */
export interface DictationDiff {
  type: "match" | "missing" | "extra" | "wrong";
  expected?: string;
  actual?: string;
}

export interface DictationResult {
  /** 0..100, one decimal place. matched characters / reference length * 100. */
  accuracy: number;
  diff: DictationDiff[];
}
