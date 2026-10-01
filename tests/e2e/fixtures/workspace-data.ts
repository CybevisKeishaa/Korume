import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toFurigana } from "@/lib/japanese/furigana";

export const LINE_COUNT = 30;
/** Line `i` starts at `3i` and is spoken for 2.5 s; the 0.5 s after it is the gap (spec §7.4 `isSpoken`). */
export const lineStart = (index: number) => (index === DUPLICATE_START[1] ? lineStartRaw(DUPLICATE_START[0]) : lineStartRaw(index));
const lineStartRaw = (index: number) => index * 3;
/** Two lines share a start time (review focus 1); line 21 has no end time. */
export const DUPLICATE_START = [14, 15] as const;
export const NULL_END_INDEX = 20;
export const lineText = (index: number) => `今日は${index + 1}番目の文を読みます。`;
export const lineTranslation = (index: number) => `Hôm nay đọc câu thứ ${index + 1}.`;
export const VIDEO_DURATION = 95;

export interface WorkspaceData {
  admin: SupabaseClient;
  videoId: string;
  lineIds: string[];
  /** A line of a different video, for the `?line=` from-another-video case. */
  foreignLineId: string;
  /** A lesson created without a duration (lesson creation never stores one): the player must supply it. */
  noDurationVideoId: string;
  userIdByEmail(email: string): Promise<string>;
  cleanup(): Promise<void>;
}

/**
 * The deterministic lesson for `shadowing-workspace.spec.ts`: one FREE video under a unique prefix with 30
 * synthetic lines (Vietnamese translations, real furigana from `toFurigana`), plus a one-line second video.
 * Inserted with the SERVICE ROLE in the test process only, removed by prefix afterwards (the transcript,
 * lines, marks, progress and bookmarks cascade from the video).
 */
export async function seedWorkspaceData(): Promise<WorkspaceData> {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("seedWorkspaceData needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const prefix = `e2e-ws-${randomUUID().slice(0, 8)}`;

  const cleanup = async () => {
    const { error } = await admin.from("videos").delete().like("youtube_video_id", `${prefix}%`);
    if (error) throw error;
  };

  async function lesson(suffix: string, title: string, count: number, duration: number | null = VIDEO_DURATION): Promise<{ videoId: string; lineIds: string[] }> {
    const video = await admin.from("videos").insert({
      youtube_video_id: `${prefix}-${suffix}`, title, library_access: "FREE", duration_seconds: duration, jlpt_level_estimate: "N3",
    }).select("id").single();
    if (video.error) throw video.error;
    const transcript = await admin.from("transcripts").insert({ video_id: video.data.id, source: "youtube_caption", language: "ja" }).select("id").single();
    if (transcript.error) throw transcript.error;
    const rows = [];
    for (let index = 0; index < count; index += 1) {
      rows.push({
        transcript_id: transcript.data.id,
        start_time: lineStart(index),
        end_time: index === NULL_END_INDEX ? null : lineStart(index) + 2.5,
        text_jp: lineText(index),
        text_translation: lineTranslation(index),
        furigana_json: await toFurigana(lineText(index)),
      });
    }
    const lines = await admin.from("transcript_lines").insert(rows).select("id, start_time");
    if (lines.error) throw lines.error;
    // Inserted in order; PostgREST returns them in insert order.
    return { videoId: video.data.id, lineIds: lines.data.map((line) => line.id as string) };
  }

  try {
    const main = await lesson("main", `${prefix} 会話の練習`, LINE_COUNT);
    const other = await lesson("other", `${prefix} 別のレッスン`, 1);
    const noDuration = await lesson("noduration", `${prefix} 長さ不明`, 3, null);
    return {
      admin,
      videoId: main.videoId,
      lineIds: main.lineIds,
      foreignLineId: other.lineIds[0]!,
      noDurationVideoId: noDuration.videoId,
      async userIdByEmail(email) {
        const user = await admin.from("users").select("id").eq("email", email).single();
        if (user.error) throw user.error;
        return user.data.id as string;
      },
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
