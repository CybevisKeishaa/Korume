export type PracticeModeId = "shadowing" | "pronunciation" | "listening";
export type LearningModeId = PracticeModeId | "summary";
export interface LearningMode { id: LearningModeId; segment: "" | "pronunciation" | "listening" | "summary"; complete: boolean }

export const LEARNING_MODES: readonly LearningMode[] = [
  { id: "shadowing", segment: "", complete: true },
  { id: "pronunciation", segment: "pronunciation", complete: true },
  { id: "listening", segment: "listening", complete: false },
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

export type ListeningFormat = "word_bank" | "typing";
export type PracticeStatsMode = "pronunciation" | ListeningFormat;

/** P10: the URL's `?format=` is the one source of the active format; anything but "typing" is Word Bank. */
export function listeningFormat(param: string | null): ListeningFormat {
  return param === "typing" ? "typing" : "word_bank";
}

/** The stats a mode reads; Listening reads its active format only (formats are never averaged). */
export function practiceStatsMode(mode: PracticeModeId, format: ListeningFormat): PracticeStatsMode | null {
  return mode === "shadowing" ? null : mode === "listening" ? format : mode;
}
