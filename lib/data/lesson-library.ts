import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";

/** Free-tier monthly Create Lesson allowance (spec §3.1). Plus is unlimited. */
export const FREE_MONTHLY_LESSON_QUOTA = 3;

/**
 * Dedup lookup by `youtube_video_id`, ALWAYS via the service-role client
 * (spec §1.3's implementation note) — an ordinary authenticated client
 * cannot see a `PRIVATE` video it holds no `user_lesson_library` row for, so
 * a plain `select` would silently miss existing private lessons and cause
 * duplicate creation.
 */
export async function findExistingLesson(youtubeVideoId: string): Promise<VideoRow | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .select(VIDEO_COLUMNS)
    .eq("youtube_video_id", youtubeVideoId)
    .maybeSingle();
  if (error) throw error;
  return (data as VideoRow | null) ?? null;
}

export async function hasTranscript(lessonId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.from("transcripts").select("id").eq("video_id", lessonId);
  if (error) throw error;
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

function startOfMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Count of `user_lesson_library` rows added this calendar month — the ONLY quota ledger (spec §3.2). */
export async function countMonthlyCreations(userId: string, now: Date = new Date()): Promise<number> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("user_lesson_library")
    .select("lesson_id")
    .eq("user_id", userId)
    .gte("added_at", startOfMonth(now));
  if (error) throw error;
  return ((data as { lesson_id: string }[] | null) ?? []).length;
}

/** Plus is always unlimited; Free is capped at `FREE_MONTHLY_LESSON_QUOTA` per calendar month. */
export async function isUnderQuota(userId: string, now: Date = new Date()): Promise<boolean> {
  const tier = await getActivePlanTier(userId);
  if (tier === "plus") return true;
  const count = await countMonthlyCreations(userId, now);
  return count < FREE_MONTHLY_LESSON_QUOTA;
}

export async function isInLibrary(userId: string, lessonId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("user_lesson_library")
    .select("user_id, lesson_id")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Idempotent add: `ignoreDuplicates` makes a re-paste of the same URL by the
 * same user a no-op rather than a duplicate-key error or a second quota hit.
 */
export async function addToLibrary(userId: string, lessonId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("user_lesson_library")
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
  if (error) throw error;
}
