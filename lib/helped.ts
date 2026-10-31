/** Spec §3.6: help used = Chế độ dễ or any hinted unit. The TS twin of SQL `dictation_attempt_helped` (migration 049). */
export function isHelped(attempt: { easyMode: boolean; hintedUnits: readonly number[] }): boolean {
  return attempt.easyMode || attempt.hintedUnits.length > 0;
}
