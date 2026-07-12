/**
 * i+1 comprehensible-input scoring types. A video is "comprehensible" when the
 * learner already knows most of its content words — the classic i+1 target is
 * ~1 unknown word per sentence, roughly an 80-95% known ratio (CLAUDE.md §5.2).
 */

/**
 * - `too-hard`: below the ideal known-word ratio — too many unknown words.
 * - `ideal`: the i+1 sweet spot — mostly known, a little new.
 * - `too-easy`: above the ideal ratio — little left to learn.
 * - `insufficient-data`: no scorable content words (e.g. no transcript yet).
 */
export type ComprehensionBand = "too-easy" | "ideal" | "too-hard" | "insufficient-data";

export interface ComprehensionScore {
  totalWords: number;
  knownWords: number;
  /** knownWords / totalWords, or 0 when totalWords is 0. */
  knownRatio: number;
  band: ComprehensionBand;
}
