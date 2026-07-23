/** Hidden tuning constants for the score-based producers (spec D5) — code
 * config like PHASE_THRESHOLDS, never surfaced in UI. */
export const TARGET_SCORE = 80;
export const MASTERY_ATTEMPTS = 3;

/**
 * `line_mastered` rule (spec D5, made deterministic): the current attempt
 * reaches the target, the line has ≥ MASTERY_ATTEMPTS scored attempts in
 * total, and at least one EARLIER attempt fell short — it *finally* got
 * there. First-try success is `first_shadow`'s territory.
 */
export function qualifiesAsLineMastered(previousScores: number[], currentScore: number): boolean {
  if (currentScore < TARGET_SCORE) return false;
  if (previousScores.length + 1 < MASTERY_ATTEMPTS) return false;
  return previousScores.some((score) => score < TARGET_SCORE);
}
