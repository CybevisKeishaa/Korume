export type LearningModeId = "shadowing" | "pronunciation" | "listening" | "summary";
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
