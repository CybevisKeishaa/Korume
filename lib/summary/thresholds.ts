import type { ModeState } from "./snapshot";

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
  listening: [REVIEW_DICTATION_BELOW, STRONG_DICTATION_AT],
  retention: [RETENTION_NEEDS_WORK_BELOW, RETENTION_STRONG_AT],
} as const;

/** The one score → state adapter (spec §5.1). Reads the rounded integers of §3.1. */
export function modeQuality(
  mode: "shadowing" | "pronunciation" | "listening" | "retention",
  state: ModeState,
): Quality {
  if (mode === "shadowing") {
    return state.kind === "complete" ? "strong" : state.kind === "in_progress" ? "practiced" : "not_started";
  }
  if (state.kind !== "scored") return "not_started";
  const [needsWorkBelow, strongAt] = CUTS[mode];
  if (state.score < needsWorkBelow) return "needs_work";
  return state.score >= strongAt ? "strong" : "practiced";
}
