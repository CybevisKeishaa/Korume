/** Hidden tuning constants for the score-based producers (spec D5) — code
 * config like PHASE_THRESHOLDS, never surfaced in UI. */
export const TARGET_SCORE = 80;
export const MASTERY_ATTEMPTS = 3;

/**
 * `line_mastered` rule (spec D5, made deterministic and aligned with spec
 * §4.3's "score trend up" — user decision, 2026-07-29, resolving the open
 * carry from Task 4): the current attempt reaches the target, the line has
 * ≥ MASTERY_ATTEMPTS scored attempts in total, at least one EARLIER attempt
 * fell short, AND the line has never been at target before now. It is a
 * ONE-TIME milestone per transcript line, not a repeatable recovery event —
 * a line already mastered at 90 must not re-fire on a later dip-then-recover
 * to 85. First-try success is `first_shadow`'s territory. Celebrating a
 * relearning-after-regression moment, if ever wanted, belongs to a separate
 * producer, not a broadened meaning of `line_mastered`.
 */
export function qualifiesAsLineMastered(previousScores: number[], currentScore: number): boolean {
  if (currentScore < TARGET_SCORE) return false;
  if (previousScores.length + 1 < MASTERY_ATTEMPTS) return false;
  if (previousScores.some((score) => score >= TARGET_SCORE)) return false;
  return previousScores.some((score) => score < TARGET_SCORE);
}
