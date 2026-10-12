/** Daily mission constants and the pure hint ranking (port-dashboard D11, M2). SQL `ensure_daily_mission` is the
 * authority: these hints only propose lessons; it revalidates access, incompleteness, transcript and targets. */
export const MISSION_TARGETS = { review: 20, shadow_lines: 3, dictation_lines: 5 } as const;
export const MISSION_PRACTICE_WINDOW_DAYS = 14;

export type MissionType = "review" | "finish_lesson" | "shadow_lines" | "dictation_lines";
type PracticeType = "shadow_lines" | "dictation_lines";
export interface PracticeActivity { type: PracticeType; count: number; lastAt: string | null; lastVideoId: string | null }
export interface MissionHint { type: Exclude<MissionType, "review">; videoId: string }

const PRACTICE_ORDER: readonly PracticeType[] = ["shadow_lines", "dictation_lines"];

/** finish_lesson on the Continue lesson; then practice modalities by window share, recency, then shadowing first.
 * Practice runs on the Continue lesson when it has lines, else on that modality's most recently practised lesson. */
export function rankMissionHints(input: {
  continueLesson: { videoId: string; hasLines: boolean } | null; practice: readonly PracticeActivity[];
}): MissionHint[] {
  const hints: MissionHint[] = input.continueLesson ? [{ type: "finish_lesson", videoId: input.continueLesson.videoId }] : [];
  const activity = PRACTICE_ORDER.map((type, order) => ({
    order, ...(input.practice.find((row) => row.type === type) ?? { type, count: 0, lastAt: null, lastVideoId: null }),
  }));
  activity.sort((a, b) =>
    b.count - a.count
    || (b.lastAt === null ? 0 : Date.parse(b.lastAt)) - (a.lastAt === null ? 0 : Date.parse(a.lastAt))
    || a.order - b.order);
  for (const row of activity) {
    const videoId = input.continueLesson?.hasLines ? input.continueLesson.videoId : row.lastVideoId;
    if (videoId) hints.push({ type: row.type, videoId });
  }
  return hints;
}
