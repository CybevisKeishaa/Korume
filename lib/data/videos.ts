import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseVideoId, fetchOembed, OembedFetchError } from "@/lib/youtube";
import { rateLimit } from "@/lib/rate-limit";
import type { ImportVideoInput, ProgressInput } from "@/lib/validation/video";

export const VIDEO_COLUMNS =
  "id, youtube_video_id, title, duration_seconds, thumbnail_url, jlpt_level_estimate, added_by_user_id, status, created_at";

export interface VideoRow {
  id: string;
  youtube_video_id: string;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  jlpt_level_estimate: string | null;
  added_by_user_id: string | null;
  status: "pending" | "approved";
  created_at: string;
}

export interface VideoProgressRow {
  user_id: string;
  video_id: string;
  last_watched_position: number;
  completed_at: string | null;
}

const IMPORT_LIMIT = { limit: 20, windowMs: 60_000 };

/** Shared by every `lib/data/videos*` module — resolves the signed-in user, or `null`. */
export async function requireUser(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Fetch a single video row by id, subject to RLS visibility. Shared with `lib/data/transcripts.ts`. */
export async function selectVideoById(
  supabase: ReturnType<typeof createClient>,
  id: string,
): Promise<VideoRow | null> {
  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as VideoRow | null) ?? null;
}

export type ImportVideoResult =
  | { ok: true; data: VideoRow }
  | { ok: false; status: 401 | 400 | 422 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Import (or re-resolve) a video by YouTube URL/ID. Idempotent: if the video
 * was already imported, its existing row is returned rather than re-fetching
 * metadata. Metadata only — never touches video bytes (CLAUDE.md §2).
 */
export async function importVideo(input: ImportVideoInput): Promise<ImportVideoResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`videos:import:${user.id}`, IMPORT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const videoId = parseVideoId(input.youtubeUrl);
  if (!videoId) return { ok: false, status: 400 };

  const { data: existing, error: lookupError } = await supabase
    .from("videos")
    .select(VIDEO_COLUMNS)
    .eq("youtube_video_id", videoId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { ok: true, data: existing as VideoRow };

  let meta;
  try {
    meta = await fetchOembed(videoId);
  } catch (err) {
    if (err instanceof OembedFetchError) return { ok: false, status: 422 };
    throw err;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("videos")
    .insert({
      youtube_video_id: videoId,
      title: meta.title,
      thumbnail_url: meta.thumbnailUrl,
      added_by_user_id: user.id,
    })
    .select(VIDEO_COLUMNS)
    .single();

  if (insertError) {
    // Unique-violation race: another request imported the same video first.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("videos")
        .select(VIDEO_COLUMNS)
        .eq("youtube_video_id", videoId)
        .maybeSingle();
      if (raced) return { ok: true, data: raced as VideoRow };
    }
    return { ok: false, status: 400 };
  }

  return { ok: true, data: inserted as VideoRow };
}

export type ListVideosResult = { ok: true; data: VideoRow[] } | { ok: false; status: 401 };

/** Videos visible to the current user (approved, or their own pending imports), newest first. */
export async function listVideos(): Promise<ListVideosResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { ok: true, data: (data as VideoRow[]) ?? [] };
}

export type GetVideoResult = { ok: true; data: VideoRow } | { ok: false; status: 401 | 404 };

export async function getVideo(id: string): Promise<GetVideoResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const video = await selectVideoById(supabase, id);
  if (!video) return { ok: false, status: 404 };
  return { ok: true, data: video };
}

export type SetVideoDurationResult = { ok: true; data: VideoRow } | { ok: false; status: 401 | 404 };

/**
 * Record a video's duration, reported once by the client from
 * `player.getDuration()`. Only writes when `duration_seconds` is still null,
 * so the first report wins; later calls just return the current row.
 */
export async function setVideoDuration(id: string, durationSeconds: number): Promise<SetVideoDurationResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data: updated, error } = await supabase
    .from("videos")
    .update({ duration_seconds: durationSeconds })
    .eq("id", id)
    .is("duration_seconds", null)
    .select(VIDEO_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (updated) return { ok: true, data: updated as VideoRow };

  const video = await selectVideoById(supabase, id);
  if (!video) return { ok: false, status: 404 };
  return { ok: true, data: video };
}

export type UpdateProgressResult = { ok: true; data: VideoProgressRow } | { ok: false; status: 401 | 400 };

export async function updateProgress(
  videoId: string,
  input: ProgressInput,
  now: Date = new Date(),
): Promise<UpdateProgressResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const row: { user_id: string; video_id: string; last_watched_position: number; completed_at?: string } = {
    user_id: user.id,
    video_id: videoId,
    last_watched_position: input.position,
  };
  if (input.completed) {
    row.completed_at = now.toISOString();
  }

  const { data, error } = await supabase
    .from("user_video_progress")
    .upsert(row, { onConflict: "user_id,video_id" })
    .select("user_id, video_id, last_watched_position, completed_at")
    .maybeSingle();
  // A bad videoId violates the FK — surface as a 400 rather than a 500.
  if (error) return { ok: false, status: 400 };

  if (input.completed) {
    // Best-effort Companion capture — never fails the progress request (§6.5).
    // Only a PATCH that actually marks completion is a milestone; a plain
    // position ping is not.
    //
    // Imported LAZILY on purpose: `lib/data/companion.ts` imports `requireUser`
    // from this module, so a top-level import here would close a static
    // videos ⇄ companion cycle. That cycle is not theoretical — it already
    // breaks module identity under Vitest (the real `companion` module pulls in
    // a second copy of this module bound to the unmocked companion, so the hook
    // silently calls the wrong instance). A dynamic import is not a static
    // graph edge, so there is no cycle to resolve at load time.
    //
    // The try/catch wraps the IMPORT as well as the call. `captureFirstVideoCompleted`
    // guards its own body, but evaluating the module is itself an awaited
    // operation that a static import would have failed at boot instead of
    // per-request — a bad chunk or a future top-level side effect in
    // `companion.ts` would otherwise reject straight into a learner's progress
    // PATCH. Never-throw is absolute, so the load is inside the guard too.
    try {
      const { captureFirstVideoCompleted } = await import("@/lib/data/companion");
      await captureFirstVideoCompleted(user.id, videoId);
    } catch (err) {
      console.error("[companion] first_video_completed hook failed:", err);
    }
  }

  return { ok: true, data: data as VideoProgressRow };
}
