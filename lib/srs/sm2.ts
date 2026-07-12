/**
 * SuperMemo-2 (SM-2) spaced-repetition engine.
 *
 * Pure and deterministic: no `Date.now()` inside — the caller passes `now`, so
 * every transition is unit-testable (CLAUDE.md §7). State maps to the
 * `user_*_progress` columns: repetitions↔srs_stage, intervalDays↔interval_days,
 * easeFactor↔ease_factor.
 *
 * Canonical SM-2 rules implemented:
 *  - quality 0–5; a grade < 3 is a lapse.
 *  - On success: reps 0→interval 1 day, reps 1→6 days, else round(interval·EF).
 *  - EF is updated ONLY on success: EF += 0.1 − (5−q)(0.08 + (5−q)·0.02),
 *    floored at 1.3. On a lapse the item restarts (reps→0, interval→1) and the
 *    E-Factor is left unchanged (SM-2 step 6).
 */

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface SrsState {
  /** Number of consecutive successful reviews (SM-2 repetition count). */
  repetitions: number;
  /** Current scheduling interval in days. */
  intervalDays: number;
  /** Ease factor, ≥ 1.3. */
  easeFactor: number;
}

export interface SrsUpdate extends SrsState {
  nextReviewAt: Date;
  lastReviewedAt: Date;
}

export const MIN_EASE_FACTOR = 1.3;
export const DEFAULT_EASE_FACTOR = 2.5;
export const PASS_THRESHOLD: Quality = 3;

/** State for an item that has never been reviewed. */
export const INITIAL_STATE: SrsState = {
  repetitions: 0,
  intervalDays: 0,
  easeFactor: DEFAULT_EASE_FACTOR,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/** Updated ease factor after a successful review of the given quality. */
function nextEaseFactor(easeFactor: number, quality: Quality): number {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return Math.max(MIN_EASE_FACTOR, easeFactor + delta);
}

/**
 * Apply one review and return the next scheduling state.
 * @throws if `quality` is not an integer in 0–5.
 */
export function reviewItem(
  state: SrsState,
  quality: Quality,
  now: Date = new Date(),
): SrsUpdate {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError(`quality must be an integer 0–5, got ${quality}`);
  }

  const passed = quality >= PASS_THRESHOLD;

  if (!passed) {
    // Lapse: restart the repetition schedule; EF is unchanged.
    return {
      repetitions: 0,
      intervalDays: 1,
      easeFactor: state.easeFactor,
      nextReviewAt: addDays(now, 1),
      lastReviewedAt: now,
    };
  }

  const easeFactor = nextEaseFactor(state.easeFactor, quality);

  let intervalDays: number;
  if (state.repetitions === 0) {
    intervalDays = 1;
  } else if (state.repetitions === 1) {
    intervalDays = 6;
  } else {
    intervalDays = Math.round(state.intervalDays * easeFactor);
  }

  return {
    repetitions: state.repetitions + 1,
    intervalDays,
    easeFactor,
    nextReviewAt: addDays(now, intervalDays),
    lastReviewedAt: now,
  };
}
