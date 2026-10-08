import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeSnapshot, LearningOutcomeSource } from "@/lib/gamification";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";

/** The counters badge criteria read (port-dashboard: shared by the award path and the Dashboard progress view). */
export async function buildBadgeSnapshot(
  supabase: SupabaseClient,
  userId: string,
  totalXp: number,
  streakCurrent: number,
): Promise<BadgeSnapshot> {
  // "Known" kanji reuses the same SRS-mastery threshold the i+1 difficulty
  // engine and adaptive-furigana feature already use for "known vocab"
  // (lib/data/difficulty.ts::MASTERY_THRESHOLD — srs_stage >= 2, i.e. two
  // successful reviews) rather than inventing a second "known" definition.
  const { data: kanjiRows, error: kanjiError } = await supabase
    .from("user_kanji_progress")
    .select("kanji_id")
    .eq("user_id", userId)
    .gte("srs_stage", MASTERY_THRESHOLD);
  if (kanjiError) throw kanjiError;
  const kanjiLearned = ((kanjiRows ?? []) as { kanji_id: string }[]).length;

  // Outcome totals/counts: no GROUP BY available through the query builder
  // without a migration (out of scope for this task), so this fetches every
  // xp_events row for the user and aggregates client-side. Acceptable today
  // because this whole block is already gated by the duplicate-outcome
  // skip above, so it only runs on genuinely new activity; revisit
  // with a DB-side aggregate (view or RPC) if a single user's xp_events grows
  // large enough for this to matter.
  const { data: outcomeRows, error: outcomeError } = await supabase
    .from("xp_events")
    .select("source_type")
    .eq("user_id", userId)
    // Plan P1: the daily mission reward is XP, not a learning outcome — it must not raise session/outcome badges.
    .neq("source_type", "daily_mission_complete");
  if (outcomeError) throw outcomeError;
  const outcomeTypeRows = (outcomeRows ?? []) as { source_type: LearningOutcomeSource }[];
  const outcomeCounts: Partial<Record<LearningOutcomeSource, number>> = {};
  for (const row of outcomeTypeRows) {
    outcomeCounts[row.source_type] = (outcomeCounts[row.source_type] ?? 0) + 1;
  }

  const { data: attemptRows, error: attemptError } = await supabase
    .from("user_test_attempts")
    .select("test_id")
    .eq("user_id", userId)
    .eq("mode", "full");
  if (attemptError) throw attemptError;
  const testIds = Array.from(new Set(((attemptRows ?? []) as { test_id: string }[]).map((row) => row.test_id)));

  let jlptMockLevelsCompleted: string[] = [];
  if (testIds.length > 0) {
    const { data: testRows, error: testError } = await supabase.from("certification_tests").select("level").in("id", testIds);
    if (testError) throw testError;
    jlptMockLevelsCompleted = Array.from(new Set(((testRows ?? []) as { level: string }[]).map((row) => row.level)));
  }

  return {
    totalXp,
    streakCurrent,
    kanjiLearned,
    totalOutcomes: outcomeTypeRows.length,
    outcomeCounts,
    jlptMockLevelsCompleted,
  };
}
