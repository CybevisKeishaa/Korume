import type { SupabaseClient } from "@supabase/supabase-js";

/** 30 lines, one distinct common noun each, so set=all reaches its 24-word cap and spans pages. */
export const PRINT_NOUNS = [
  "学校", "先生", "電車", "天気", "時間", "写真", "映画", "料理", "音楽", "仕事", "会社", "家族", "友達", "部屋", "新聞",
  "手紙", "季節", "公園", "病院", "図書館", "銀行", "会議", "旅行", "野菜", "果物", "動物", "自転車", "飛行機", "番組", "世界",
];
export const LONG_TITLE = `${"とても長いレッスンのタイトルが続きます".repeat(4)}-https://example.com/a/very/long/unbroken/path/segment`;

export async function seedPrintLesson(admin: SupabaseClient, prefix: string): Promise<{ videoId: string; lineIds: string[] }> {
  const video = await admin.from("videos").insert({
    youtube_video_id: `${prefix}-print`, title: LONG_TITLE, library_access: "FREE", duration_seconds: 120, jlpt_level_estimate: "N4",
  }).select("id").single();
  if (video.error) throw video.error;
  const transcript = await admin.from("transcripts").insert({ video_id: video.data.id, source: "youtube_caption", language: "ja" }).select("id").single();
  if (transcript.error) throw transcript.error;
  const lines = await admin.from("transcript_lines").insert(PRINT_NOUNS.map((noun, index) => ({
    transcript_id: transcript.data.id, start_time: index * 3, end_time: index * 3 + 2.5, text_jp: `これは${noun}の話です。`, text_translation: null,
  }))).select("id");
  if (lines.error) throw lines.error;
  return { videoId: video.data.id, lineIds: lines.data.map((line) => line.id as string) };
}
