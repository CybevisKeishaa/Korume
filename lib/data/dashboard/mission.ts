import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureDailyMission, claimActiveMission } from "@/lib/data/missions";
import { getDashboardContext } from "./context";
import { getReviewSummary } from "./review";
import type { MissionType } from "@/lib/dashboard/missions";
import { loadCard, type CardState } from "@/components/dashboard/card-boundary";

export interface MissionView { items: { type: MissionType; current: number; target: number; title: string | null; href: string; playbackPercent: number | null }[]; rewarded: boolean; }
interface ProgressRow { type: MissionType; video_id: string | null; target: number; current: number }
interface LessonRow { id: string; title: string; duration_seconds: number | null; last_watched_position: number | null }

async function loadDailyMission(): Promise<MissionView | null> {
  const context = await getDashboardContext();
  if (!context) return null;
  const missionId = await ensureDailyMission(context.userId);
  if (!missionId) return null;
  await claimActiveMission(context.userId);
  const supabase = createClient();
  const [review, { data: progress, error }, { data: mission, error: missionError }] = await Promise.all([
    getReviewSummary(),
    supabase.rpc("daily_mission_item_progress", { p_mission_id: missionId }),
    supabase.from("daily_missions").select("rewarded_at").eq("id", missionId).maybeSingle(),
  ]);
  if (error) throw error;
  if (missionError) throw missionError;
  const rows = (progress as ProgressRow[] | null) ?? [];
  const ids = rows.flatMap((row) => row.video_id ? [row.video_id] : []);
  const titles = new Map<string, string>();
  const lessons = new Map<string, LessonRow>();
  if (ids.length) { const { data, error: titleError } = await supabase.from("learner_videos").select("id, title, duration_seconds, last_watched_position").in("id", ids); if (titleError) throw titleError; for (const row of (data as LessonRow[] | null) ?? []) { titles.set(row.id, row.title); lessons.set(row.id, row); } }
  return { rewarded: Boolean((mission as { rewarded_at: string | null } | null)?.rewarded_at), items: rows.map((row) => {
    const lesson = row.video_id ? lessons.get(row.video_id) : null;
    const playbackPercent = row.type === "finish_lesson" && lesson?.duration_seconds && lesson.duration_seconds > 0
      ? Math.min(100, Math.max(0, Math.round(100 * (lesson.last_watched_position ?? 0) / lesson.duration_seconds))) : null;
    return { type: row.type, current: row.current, target: row.target, title: row.video_id ? titles.get(row.video_id) ?? null : null, href: row.type === "review" ? review.href : row.type === "dictation_lines" ? `/shadowing/${row.video_id}/dictation` : `/shadowing/${row.video_id}`, playbackPercent };
  }) };
}

export const getDailyMission = cache(async (): Promise<CardState<MissionView>> => {
  const state = await loadCard("mission", loadDailyMission);
  if (state.kind === "ok") return state.data === null ? { kind: "unavailable" } : { kind: "ok", data: state.data };
  return state;
});
