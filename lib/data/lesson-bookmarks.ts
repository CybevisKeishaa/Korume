import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import type { SetSentenceMarkResult } from "@/lib/data/sentence-marks";

const WRITE_LIMIT = { limit: 30, windowMs: 60_000 };

export async function isLessonBookmarked(videoId: string): Promise<boolean> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return false;
  const { data, error } = await supabase.from("user_lesson_bookmarks").select("video_id")
    .eq("user_id", user.id).eq("video_id", videoId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function setLessonBookmark(videoId: string, bookmarked: boolean): Promise<SetSentenceMarkResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const limit = rateLimit(`lesson-bookmark:${user.id}`, WRITE_LIMIT);
  if (!limit.ok) return { ok: false, status: 429, retryAfter: limit.retryAfter };
  if (!bookmarked) {
    const { error } = await supabase.from("user_lesson_bookmarks").delete()
      .eq("user_id", user.id).eq("video_id", videoId);
    if (error) throw error;
    return { ok: true };
  }
  const { error } = await supabase.from("user_lesson_bookmarks").insert({ user_id: user.id, video_id: videoId });
  if (!error || error.code === "23505") return { ok: true };
  if (error.code === "42501" || error.code === "23503") return { ok: false, status: 404 };
  throw error;
}
