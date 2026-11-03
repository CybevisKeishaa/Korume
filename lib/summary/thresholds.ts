import type { LessonStatus, ModeState } from "./snapshot";

// ponytail: fixed cut-offs, tuned after the owner's live look; a per-learner calibration if they prove wrong.
export const REVIEW_PRONUNCIATION_BELOW = 60;
export const REVIEW_DICTATION_BELOW = 80;
export const STRONG_PRONUNCIATION_AT = 80;
export const STRONG_DICTATION_AT = 95;
export const RETENTION_NEEDS_WORK_BELOW = 50;
export const RETENTION_STRONG_AT = 80;

export type Quality = "not_started" | "practiced" | "strong" | "needs_work";

const CUTS = {
  pronunciation: [REVIEW_PRONUNCIATION_BELOW, STRONG_PRONUNCIATION_AT],
  // Both Listening formats share the one Listening cut (R2).
  listeningDictation: [REVIEW_DICTATION_BELOW, STRONG_DICTATION_AT],
  listeningCloze: [REVIEW_DICTATION_BELOW, STRONG_DICTATION_AT],
  retention: [RETENTION_NEEDS_WORK_BELOW, RETENTION_STRONG_AT],
} as const;

/**
 * A single result's band, on the same cuts as the lesson state below — so the chime a learner hears after one sentence
 * agrees with what Summary later calls that mode (owner 2026-10-31: different sounds for low and good scores).
 */
export function scoreBand(mode: keyof typeof CUTS, score: number): Exclude<Quality, "not_started"> {
  const [needsWorkBelow, strongAt] = CUTS[mode];
  return score < needsWorkBelow ? "needs_work" : score >= strongAt ? "strong" : "practiced";
}

/** The one score → state adapter (spec §5.1). Reads the rounded integers of §3.1. */
export function modeQuality(mode: keyof LessonStatus, state: ModeState): Quality {
  if (mode === "shadowing") {
    return state.kind === "complete" ? "strong" : state.kind === "in_progress" || state.kind === "reached" ? "practiced" : "not_started";
  }
  if (state.kind !== "scored") return "not_started";
  return scoreBand(mode, state.score);
}
