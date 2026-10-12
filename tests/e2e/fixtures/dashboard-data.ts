import type { SupabaseClient } from "@supabase/supabase-js";
import { MISSION_TARGETS, rankMissionHints } from "@/lib/dashboard/missions";
import { lineText, seedWorkspaceData, type WorkspaceData } from "./workspace-data";

export async function seedDashboardWorkspaceData(): Promise<WorkspaceData> {
  const lesson = await seedWorkspaceData();
  try {
    // Dashboard-only evidence must not evict the provider seed from the Hub's capped recent shelves.
    const dated = await lesson.admin.from("videos").update({ created_at: "2000-01-01T00:00:00Z" })
      .like("youtube_video_id", `${lesson.prefix}%`).select("id,created_at");
    if (dated.error) throw dated.error;
    if (dated.data.length !== 3 || dated.data.some((row) => Date.parse(row.created_at) !== Date.parse("2000-01-01T00:00:00Z"))) {
      throw new Error("dashboard workspace must contain exactly three backdated lessons");
    }
    return lesson;
  } catch (error) {
    await lesson.cleanup();
    throw error;
  }
}

export async function seedDashboardData(
  admin: SupabaseClient,
  userId: string,
  lesson: WorkspaceData,
): Promise<{ cleanup(): Promise<void> }> {
  const kanji = await admin.from("kanji").select("id").order("id").limit(1).single();
  if (kanji.error) throw kanji.error;
  const now = new Date();
  const earlier = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const cleanup = async () => {
    const results = await Promise.all([
      admin.from("user_kanji_progress").delete().eq("user_id", userId).eq("kanji_id", kanji.data.id),
      admin.from("user_video_progress").delete().eq("user_id", userId).eq("video_id", lesson.videoId),
      admin.from("sentence_mining_cards").delete().eq("user_id", userId).eq("video_id", lesson.videoId),
      admin.from("dictation_attempts").delete().eq("user_id", userId).eq("video_id", lesson.videoId),
      admin.from("shadowing_sessions").delete().eq("user_id", userId).eq("video_id", lesson.videoId),
      admin.from("learning_outcomes").delete().eq("user_id", userId),
      admin.from("daily_missions").delete().eq("user_id", userId),
    ]);
    for (const result of results) if (result.error) throw result.error;
  };
  try {
    const scores = [now.toISOString(), earlier].flatMap((created_at) =>
      lesson.lineIds.slice(0, 3).map((transcript_line_id) => ({
        user_id: userId, video_id: lesson.videoId, transcript_line_id, created_at,
      })),
    );
    const seeded = await Promise.all([
      admin.from("user_kanji_progress").insert({
        user_id: userId, kanji_id: kanji.data.id, srs_stage: 1,
        next_review_at: earlier, last_reviewed_at: earlier,
      }),
      admin.from("user_video_progress").insert({ user_id: userId, video_id: lesson.videoId, last_watched_position: 30 }),
      admin.from("dictation_attempts").insert(scores.map((row) => ({ ...row, user_input: "今日は", accuracy_score: 55 }))),
      admin.from("shadowing_sessions").insert(scores.map((row) => ({ ...row, pronunciation_score: 65, pitch_score: 60, rhythm_score: 70 }))),
      admin.from("learning_outcomes").insert({ user_id: userId, source_type: "dictation", item_key: lesson.lineIds[0], created_at: now.toISOString() }),
    ]);
    for (const result of seeded) if (result.error) throw result.error;
    // Freeze one eligible review, then add a due mining card: the mission stays 1 while Quick Access sees 2.
    const mission = await admin.rpc("ensure_daily_mission", {
      p_user: userId, p_review_decks: ["kanji", "mining"], p_targets: MISSION_TARGETS,
      p_hints: rankMissionHints({ continueLesson: { videoId: lesson.videoId, hasLines: true }, practice: [] }),
    });
    if (mission.error) throw mission.error;
    if (!mission.data) throw new Error("dashboard evidence must create a daily mission");
    const mining = await admin.from("sentence_mining_cards").insert({
      user_id: userId, video_id: lesson.videoId, transcript_line_id: lesson.lineIds[0],
      target_word: "今日", source_ref: "今日", source_kind: "selection",
      sentence_jp: lineText(0), next_review_at: null,
    });
    if (mining.error) throw mining.error;
    return { cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
