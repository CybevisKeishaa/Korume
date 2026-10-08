import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exposedReviewSurfaces } from "@/lib/dashboard/review-surfaces";
import { DAILY_MISSION_XP } from "@/lib/gamification/xp";
import { afterXpAward } from "@/lib/data/xp-award";
import {
  MISSION_PRACTICE_WINDOW_DAYS,
  MISSION_TARGETS,
  rankMissionHints,
  type MissionHint,
  type PracticeActivity,
} from "@/lib/dashboard/missions";

interface PracticeActivityRow { type: PracticeActivity["type"]; outcomes: number; last_at: string | null; last_video_id: string | null }

/** Lesson hints for the SQL authority (spec M2): the D5 Continue lesson (P3 `in_progress`) and 14-day practice. */
async function buildMissionHints(supabase: SupabaseClient, now: Date): Promise<MissionHint[]> {
  const since = new Date(now.getTime() - MISSION_PRACTICE_WINDOW_DAYS * 86_400_000).toISOString();
  const [candidate, practice] = await Promise.all([
    supabase.from("learner_videos").select("id").eq("in_progress", true)
      .order("in_progress_last_watched_at", { ascending: false, nullsFirst: false }).order("id").limit(1).maybeSingle(),
    supabase.rpc("practice_activity", { p_since: since }),
  ]);
  if (candidate.error) throw candidate.error;
  if (practice.error) throw practice.error;

  const videoId = (candidate.data as { id: string } | null)?.id ?? null;
  let hasLines = false;
  if (videoId) {
    const transcript = await supabase.rpc("current_transcript_id", { p_video_id: videoId });
    if (transcript.error) throw transcript.error;
    if (transcript.data) {
      const lines = await supabase.from("transcript_lines").select("id", { count: "exact", head: true })
        .eq("transcript_id", transcript.data as string);
      if (lines.error) throw lines.error;
      hasLines = (lines.count ?? 0) > 0;
    }
  }
  return rankMissionHints({
    continueLesson: videoId ? { videoId, hasLines } : null,
    practice: ((practice.data as PracticeActivityRow[] | null) ?? []).map((row) => ({
      type: row.type, count: row.outcomes, lastAt: row.last_at, lastVideoId: row.last_video_id,
    })),
  });
}

/** PostgREST errors are plain objects: String() would log "[object Object]". */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

/** Pre-write mission ensure (spec M1/M2). Never throws: failure is degraded tracking, logged, and the learning
 * write proceeds. A cheap RLS read short-circuits when a cycle is active; SQL stays the authority either way. */
export async function ensureDailyMission(userId: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const now = new Date();
    const active = await supabase.from("daily_missions").select("id")
      .lte("window_start", now.toISOString()).gt("window_end", now.toISOString()).maybeSingle();
    if (active.error) throw active.error;
    if (active.data) return (active.data as { id: string }).id;
    const hints = await buildMissionHints(supabase, now);
    const { data, error } = await createServiceClient().rpc("ensure_daily_mission", {
      p_user: userId,
      p_review_decks: exposedReviewSurfaces().map((surface) => surface.deck),
      p_targets: MISSION_TARGETS,
      p_hints: hints,
    });
    if (error) throw error;
    return (data as string | null) ?? null;
  } catch (error) {
    console.error(JSON.stringify({ event: "mission_ensure_failed", userId, error: describeError(error) }));
    return null;
  }
}

interface ClaimRow { completed: boolean; xp_awarded: number; prev_xp: number | null; next_xp: number | null }

/** After a qualifying write committed: claim any unrewarded cycle that is now complete (spec M4). Cycles that closed
 * at most a day ago stay claimable (a late claim), so at most two are read. Never throws. */
export async function claimActiveMission(userId: string, now: Date = new Date()): Promise<void> {
  try {
    const service = createServiceClient();
    const open = await service.from("daily_missions").select("id").eq("user_id", userId).is("rewarded_at", null)
      .gt("window_end", new Date(now.getTime() - 86_400_000).toISOString())
      .order("window_end", { ascending: true }).limit(2);
    if (open.error) throw open.error;
    for (const { id } of (open.data as { id: string }[] | null) ?? []) {
      const { data, error } = await service.rpc("claim_daily_mission", { p_user: userId, p_mission_id: id, p_xp: DAILY_MISSION_XP });
      if (error) throw error;
      const row = (data as ClaimRow[] | null)?.[0];
      if (row && row.xp_awarded > 0 && row.prev_xp !== null && row.next_xp !== null) {
        await afterXpAward(service, { userId, prevXp: row.prev_xp, nextXp: row.next_xp, now });
      }
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "mission_claim_failed", userId, error: describeError(error) }));
  }
}
