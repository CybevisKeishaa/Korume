import type { RelationshipPhase } from "./types";

/** XP thresholds for each relationship phase (spec §4.1). Hidden tuning
 * constants — NEVER surfaced to the user. Index i is the minimum XP for
 * phase (i + 1). Must be strictly increasing so the function is monotonic. */
export const PHASE_THRESHOLDS = [0, 500, 2500, 10000] as const;

/** Pure, deterministic map from lifetime XP to relationship phase. Monotonic
 * non-decreasing by construction (thresholds increase, XP never decreases). */
export function relationshipPhaseForXp(xp: number): RelationshipPhase {
  if (xp >= PHASE_THRESHOLDS[3]!) return 4;
  if (xp >= PHASE_THRESHOLDS[2]!) return 3;
  if (xp >= PHASE_THRESHOLDS[1]!) return 2;
  return 1;
}
