import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, type RequireAdminResult } from "@/lib/admin/guard";
import { parseVideoId, fetchOembed, OembedFetchError } from "@/lib/youtube";
import { toFurigana } from "@/lib/japanese";
import { rateLimit } from "@/lib/rate-limit";
import { youtubeCaptionProvider } from "@/lib/data/transcript-providers";
import {
  addToLibrary,
  findExistingLesson,
  hasTranscript,
  isInLibrary,
  isUnderQuota,
} from "@/lib/data/lesson-library";
import { VIDEO_COLUMNS, requireUser, type LibraryAccess, type VideoRow } from "@/lib/data/videos";

/**
 * "Create Lesson" pipeline (spec §2.1). This is the ONE entry point for
 * turning a YouTube URL into a studyable Lesson row — used by the
 * learner-facing flow (`createLesson`) AND the admin seed flow
 * (`createLessonAsAdmin`, spec §4.1 Phase 1) so the dedup/caption-fetch/
 * transcript-insert logic never has to be written twice.
 */

const CREATE_LIMIT = { limit: 20, windowMs: 60_000 };

export type TranscriptStatus = "existing" | "fetched" | "missing";

export interface CreateLessonInput {
  youtubeUrl: string;
}

export type CreateLessonResult =
  | { ok: true; data: VideoRow; alreadyInLibrary: boolean; transcriptStatus: TranscriptStatus }
  | { ok: false; status: 401 | 400 | 422 }
  | { ok: false; status: 403; reason: "quota_exceeded" }
  | { ok: false; status: 429; retryAfter: number };

type GuardFailure = Extract<RequireAdminResult, { ok: false }>;

export interface CreateLessonAsAdminInput {
  youtubeUrl: string;
  libraryAccess: Exclude<LibraryAccess, "PRIVATE">;
}

export type CreateLessonAsAdminResult =
  | { ok: true; data: VideoRow; transcriptStatus: TranscriptStatus }
  | GuardFailure
  | { ok: false; status: 400 | 422 };

/** Inserts the `videos` row (service-role) and attempts the caption fetch; shared by both entry points. */
async function insertLessonAndFetchTranscript(
  videoId: string,
  meta: { title: string; thumbnailUrl: string },
  addedByUserId: string | null,
  libraryAccess: LibraryAccess,
): Promise<{ lesson: VideoRow; transcriptStatus: TranscriptStatus }> {
  const service = createServiceClient();
  const { data: inserted, error: insertError } = await service
    .from("videos")
    .insert({
      youtube_video_id: videoId,
      title: meta.title,
      thumbnail_url: meta.thumbnailUrl,
      added_by_user_id: addedByUserId,
      library_access: libraryAccess,
    })
    .select(VIDEO_COLUMNS)
    .single();
  if (insertError) throw insertError;

  const lesson = inserted as VideoRow;
  const transcriptStatus = await attemptCaptionFetch(lesson.id, videoId);
  return { lesson, transcriptStatus };
}

/** Attempts the caption-fetch → transcript/transcript_lines insert for an existing lesson row. */
async function attemptCaptionFetch(lessonId: string, youtubeVideoId: string): Promise<TranscriptStatus> {
  const captionResult = await youtubeCaptionProvider.fetch(youtubeVideoId);
  if (!captionResult) return "missing";

  const service = createServiceClient();
  const { data: transcript, error: transcriptError } = await service
    .from("transcripts")
    .insert({ video_id: lessonId, source: captionResult.source, language: "ja" })
    .select("id")
    .single();
  if (transcriptError) throw transcriptError;

  const transcriptId = (transcript as { id: string }).id;
  const linesWithFurigana = [];
  for (const line of captionResult.lines) {
    let furigana: unknown = null;
    try {
      furigana = await toFurigana(line.textJp);
    } catch (err) {
      // Best-effort, same posture as lib/data/admin-videos.ts::replaceVideoTranscript —
      // a tokenizer hiccup must not fail the whole caption ingest.
      console.error(`[lesson-creation] furigana generation failed for a caption line on lesson ${lessonId}:`, err);
    }
    linesWithFurigana.push({
      transcript_id: transcriptId,
      start_time: line.startTime,
      end_time: line.endTime,
      text_jp: line.textJp,
      text_translation: line.textTranslation,
      furigana_json: furigana,
    });
  }

  const { error: linesError } = await service.from("transcript_lines").insert(linesWithFurigana);
  if (linesError) throw linesError;

  return "fetched";
}

export async function createLesson(input: CreateLessonInput): Promise<CreateLessonResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`lessons:create:${user.id}`, CREATE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const videoId = parseVideoId(input.youtubeUrl);
  if (!videoId) return { ok: false, status: 400 };

  const existing = await findExistingLesson(videoId);

  // Already published: no quota, no library row — the learner just gets in (spec §2.1 step 3).
  // Still must confirm the transcript actually exists (an admin-seeded row can be published with
  // captions still missing) rather than blindly reporting "existing" — mirrors the same check
  // `createLessonAsAdmin`'s existing-lesson branch already does.
  if (existing && existing.library_access !== "PRIVATE") {
    const transcriptStatus = (await hasTranscript(existing.id))
      ? "existing"
      : await attemptCaptionFetch(existing.id, videoId);
    return { ok: true, data: existing, alreadyInLibrary: false, transcriptStatus };
  }

  // Existing PRIVATE lesson that already has a transcript: dedup hit (spec §2.1 step 4).
  if (existing && (await hasTranscript(existing.id))) {
    const alreadyMember = await isInLibrary(user.id, existing.id);
    if (!alreadyMember) {
      if (!(await isUnderQuota(user.id))) return { ok: false, status: 403, reason: "quota_exceeded" };
      await addToLibrary(user.id, existing.id);
    }
    return { ok: true, data: existing, alreadyInLibrary: alreadyMember, transcriptStatus: "existing" };
  }

  // Either no lesson at all, or an orphaned PRIVATE lesson with no transcript yet (spec §2.1 step 5).
  if (!(await isUnderQuota(user.id))) return { ok: false, status: 403, reason: "quota_exceeded" };

  let transcriptStatus: TranscriptStatus;
  let lesson: VideoRow;
  if (existing) {
    lesson = existing;
    transcriptStatus = await attemptCaptionFetch(lesson.id, videoId);
  } else {
    let meta;
    try {
      meta = await fetchOembed(videoId);
    } catch (err) {
      if (err instanceof OembedFetchError) return { ok: false, status: 422 };
      throw err;
    }
    const result = await insertLessonAndFetchTranscript(videoId, meta, user.id, "PRIVATE");
    lesson = result.lesson;
    transcriptStatus = result.transcriptStatus;
  }

  // Only a confirmed-studyable lesson consumes a slot (spec §2.1 step 5/6, §3.2).
  if (transcriptStatus === "fetched") {
    await addToLibrary(user.id, lesson.id);
  }

  return { ok: true, data: lesson, alreadyInLibrary: false, transcriptStatus };
}

export async function createLessonAsAdmin(input: CreateLessonAsAdminInput): Promise<CreateLessonAsAdminResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const videoId = parseVideoId(input.youtubeUrl);
  if (!videoId) return { ok: false, status: 400 };

  const existing = await findExistingLesson(videoId);
  if (existing) {
    const transcriptStatus = (await hasTranscript(existing.id)) ? "existing" : await attemptCaptionFetch(existing.id, videoId);
    return { ok: true, data: existing, transcriptStatus };
  }

  let meta;
  try {
    meta = await fetchOembed(videoId);
  } catch (err) {
    if (err instanceof OembedFetchError) return { ok: false, status: 422 };
    throw err;
  }

  const { lesson, transcriptStatus } = await insertLessonAndFetchTranscript(videoId, meta, null, input.libraryAccess);
  return { ok: true, data: lesson, transcriptStatus };
}
