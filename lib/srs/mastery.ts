/** First-transition mastery timestamp shared by every SRS model (port-dashboard S2). Each model decides
 * `wasMastered`/`isMastered` with its own predicate; this only decides what `mastered_at` to write. */
export function masteryTransition(input: {
  wasMastered: boolean; isMastered: boolean; existingMasteredAt: string | null; now: Date;
}): string | null {
  if (input.existingMasteredAt !== null) return input.existingMasteredAt;
  return !input.wasMastered && input.isMastered ? input.now.toISOString() : null;
}
