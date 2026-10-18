import type { PracticeModeId } from "@/lib/shadowing-workspace/learning-modes";

export function LessonStatStrip({ mode }: { mode: Exclude<PracticeModeId, "shadowing"> }) {
  return <div data-testid="lesson-stat-strip" data-mode={mode} />;
}
