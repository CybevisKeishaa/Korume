export type PracticeModeId = "shadowing" | "pronunciation" | "listening";
export type LearningModeId = PracticeModeId | "summary";
export interface LearningMode { id: LearningModeId; segment: "" | "pronunciation" | "listening" | "summary"; complete: boolean }

export const LEARNING_MODES: readonly LearningMode[] = [
  { id: "shadowing", segment: "", complete: true },
  { id: "pronunciation", segment: "pronunciation", complete: false },
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
