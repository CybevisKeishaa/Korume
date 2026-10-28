export type PracticeModeId = "shadowing" | "pronunciation" | "listening";
export type LearningModeId = PracticeModeId | "summary";
export interface LearningMode { id: LearningModeId; segment: "" | "pronunciation" | "listening" | "summary"; complete: boolean }

export const LEARNING_MODES: readonly LearningMode[] = [
  { id: "shadowing", segment: "", complete: true },
  { id: "pronunciation", segment: "pronunciation", complete: true },
  { id: "listening", segment: "listening", complete: true },
  { id: "summary", segment: "summary", complete: true },
];

export function completedModes(modes: readonly LearningMode[] = LEARNING_MODES): LearningMode[] {
  return modes.filter((mode) => mode.complete);
}

export function shouldRenderModeNav(modes?: readonly LearningMode[]): boolean {
  return completedModes(modes).length >= 2;
}

/** Derived during render so the first frame already uses the current mode. */
export function practiceModeFromPath(pathname: string): PracticeModeId {
  const segment = pathname.replace(/\/+$/, "").match(/\/shadowing\/[^/]+\/([^/]+)$/)?.[1];
  return segment === "pronunciation" || segment === "listening" ? segment : "shadowing";
}

/** Spec §3.0: Chép chính tả (dictation) and Điền từ (cloze); the URL's `?format=` carries it. */
export type ListeningExercise = "dictation" | "cloze";
/** The stored `dictation_attempts.format`: dictation writes typing, or word_bank in Chế độ dễ (§3.1). */
export type ListeningFormat = "word_bank" | "typing" | "cloze";
export type PracticeStatsMode = "pronunciation" | ListeningExercise;

/** Old links `typing` / `word_bank` open Chép chính tả (`word_bank` with Chế độ dễ on); anything else has no exercise. */
export function listeningExercise(param: string | null): { exercise: ListeningExercise | null; easyFromLegacy: boolean; legacy: boolean } {
  if (param === "dictation" || param === "cloze") return { exercise: param, easyFromLegacy: false, legacy: false };
  if (param === "typing" || param === "word_bank") return { exercise: "dictation", easyFromLegacy: param === "word_bank", legacy: true };
  return { exercise: null, easyFromLegacy: false, legacy: false };
}

export function dictationFormat(easy: boolean): "typing" | "word_bank" {
  return easy ? "word_bank" : "typing";
}

/** The stats a mode reads; Listening reads its active exercise only (exercises are never averaged), none without one. */
export function practiceStatsMode(mode: PracticeModeId, exercise: ListeningExercise | null): PracticeStatsMode | null {
  return mode === "shadowing" ? null : mode === "listening" ? exercise : mode;
}
