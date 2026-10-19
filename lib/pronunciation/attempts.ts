import type { PitchAccentScore } from "@/lib/pitch/score";
import type { Assessment } from "./assessment";

export type AttemptPhase = "recording" | "converting" | "convert-failed" | "saving" | "save-failed" | "scoring" | "scored"
  | "unscored-unavailable" | "unscored-throttled" | "unscored-unheard" | "unscored-error";

export interface Attempt {
  lineId: string;
  phase: AttemptPhase;
  original: Blob | null;
  wav: Blob | null;
  pitch: PitchAccentScore | null;
  sessionId: string | null;
  signedUrl: string | null;
  result: { pronunciationScore: number; rhythmScore: number; assessment: Assessment } | null;
  retryAfter: number | null;
}

export type AttemptAction =
  | { type: "start"; lineId: string }
  | { type: "recorded"; lineId: string; original: Blob }
  | { type: "converted"; lineId: string; wav: Blob; pitch: PitchAccentScore | null }
  | { type: "convert-failed"; lineId: string }
  | { type: "saving"; lineId: string }
  | { type: "saved"; lineId: string; sessionId: string; signedUrl: string }
  | { type: "save-failed"; lineId: string }
  | { type: "scoring"; sessionId: string }
  | { type: "scored"; sessionId: string; result: NonNullable<Attempt["result"]> }
  | { type: "score-failed"; sessionId: string; kind: ScoreFailureKind; retryAfter: number | null }
  | { type: "discard"; lineId: string };

export type AttemptsState = Record<string, Attempt>;

/** `unheard`: Azure found no speech in the take (422); the same audio can never score, only a new take can. */
export type ScoreFailureKind = "unavailable" | "throttled" | "unheard" | "error";

export const UNSAVED_PHASES: ReadonlySet<AttemptPhase> = new Set([
  "recording", "converting", "convert-failed", "saving", "save-failed",
]);

export function hasUnsaved(state: AttemptsState): boolean {
  return Object.values(state).some((attempt) => UNSAVED_PHASES.has(attempt.phase));
}

export function attemptsReducer(state: AttemptsState, action: AttemptAction): AttemptsState {
  if (action.type === "start") {
    return { ...state, [action.lineId]: {
      lineId: action.lineId, phase: "recording", original: null, wav: null, pitch: null,
      sessionId: null, signedUrl: null, result: null, retryAfter: null,
    } };
  }
  const attempt = "lineId" in action ? state[action.lineId]
    : Object.values(state).find((candidate) => candidate.sessionId === action.sessionId);
  // A late callback must never recreate a discarded take or attach to a newer session.
  if (!attempt) return state;
  if (action.type === "discard") {
    const next = { ...state };
    delete next[action.lineId];
    return next;
  }
  let update: Partial<Attempt>;
  switch (action.type) {
    case "recorded": update = { phase: "converting", original: action.original }; break;
    case "converted": update = { phase: "saving", wav: action.wav, pitch: action.pitch }; break;
    case "convert-failed": update = { phase: "convert-failed" }; break;
    case "saving": update = { phase: "saving" }; break;
    case "saved": update = { phase: "scoring", sessionId: action.sessionId, signedUrl: action.signedUrl }; break;
    case "save-failed": update = { phase: "save-failed" }; break;
    case "scoring": update = { phase: "scoring", retryAfter: null }; break;
    case "scored": update = { phase: "scored", result: action.result, retryAfter: null }; break;
    case "score-failed": update = { phase: `unscored-${action.kind}`, retryAfter: action.retryAfter }; break;
  }
  return { ...state, [attempt.lineId]: { ...attempt, ...update } };
}
