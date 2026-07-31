import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, type RequireAdminResult } from "@/lib/admin/guard";
import { rateLimit } from "@/lib/rate-limit";
import { parseTranscript } from "@/lib/transcript";
import type { TranscriptFormat } from "@/lib/transcript";
import { toFurigana } from "@/lib/japanese";

/**
 * Admin video-approval data layer (spec §3.11/§5, CLAUDE.md §2.1 — metadata/
 * transcript only, never video bytes). Every function here starts with
 * `requireAdmin()` and does all reads/writes through the service-role
 * client — `videos` has ZERO `authenticated` UPDATE grant (migration
 * 20260712000009 comment) and content-moderation writes must not depend on
 * RLS/grants meant for ordinary learners at all.
 */

type GuardFailure = Extract<RequireAdminResult, { ok: false }>;

const PAGE_SIZE = 20;
const APPROVE_LIMIT = { limit: 30, windowMs: 60_000 };
const REJECT_LIMIT = { limit: 30, windowMs: 60_000 };
const TRANSCRIPT_LIMIT = { limit: 10, windowMs: 60_000 };
const MAX_TRANSCRIPT_LINES = 2000;

const PENDING_COLUMNS =
  "id, youtube_video_id, title, duration_seconds, thumbnail_url, jlpt_level_estimate, added_by_user_id, library_access, promotion_starred, created_at";

export interface PendingVideoRow {
  id: string;
  youtube_video_id: string;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  jlpt_level_estimate: string | null;
  added_by_user_id: string | null;
  library_access: "PRIVATE" | "FREE" | "PLUS";
  promotion_starred: boolean;
  created_at: string;
}

export interface PendingVideoListItem extends PendingVideoRow {
  importerName: string | null;
  hasTranscript: boolean;
  transcriptLineCount: number;
}

export interface PendingVideosPage {
  items: PendingVideoListItem[];
  /** `created_at` of the last item on this page; pass back as `cursor` for
   * the next page. `null` when there is no further page. */
  nextCursor: string | null;
}

export type ListPendingVideosResult = { ok: true; data: PendingVideosPage } | GuardFailure;

/**
 * Pending-video review queue, oldest first (creation order — matches "duyệt
 * video mới" as a FIFO moderation queue). Keyset-paginated on `created_at`
 * (`cursor` = the previous page's last `created_at`); fetches `PAGE_SIZE + 1`
 * rows to detect whether a further page exists without a separate count
 * query. Importer name and transcript presence/line-count are resolved with
 * a few follow-up `IN (...)` queries rather than a nested embed — keeps this
 * portable to the test mock (`test/supabase-mock.ts` has no query-planner, so
 * a real multi-level PostgREST embed can't be exercised deterministically
 * here) and the pending queue is expected to be small.
 */
export async function listNeedsReview(cursor?: string): Promise<ListPendingVideosResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  let query = service
    .from("videos")
    .select(PENDING_COLUMNS)
    .eq("library_access", "PRIVATE")
    .order("created_at", { ascending: true })
    .limit(PAGE_SIZE + 1);
  if (cursor) query = query.gt("created_at", cursor);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data as PendingVideoRow[]) ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const videoIds = page.map((v) => v.id);
  const importerIds = [...new Set(page.map((v) => v.added_by_user_id).filter((id): id is string => id !== null))];

  const importerNames = new Map<string, string | null>();
  if (importerIds.length > 0) {
    const { data: users, error: usersError } = await service.from("users").select("id, name").in("id", importerIds);
    if (usersError) throw usersError;
    for (const u of (users as { id: string; name: string | null }[]) ?? []) {
      importerNames.set(u.id, u.name);
    }
  }

  // Most-recent transcript per video (matches getTranscript()'s "newest
  // transcript wins" convention in lib/data/transcripts.ts).
  const transcriptByVideo = new Map<string, { id: string; createdAt: string }>();
  if (videoIds.length > 0) {
    const { data: transcripts, error: transcriptsError } = await service
      .from("transcripts")
      .select("id, video_id, created_at")
      .in("video_id", videoIds)
      .order("created_at", { ascending: false });
    if (transcriptsError) throw transcriptsError;
    for (const t of (transcripts as { id: string; video_id: string; created_at: string }[]) ?? []) {
      if (!transcriptByVideo.has(t.video_id)) {
        transcriptByVideo.set(t.video_id, { id: t.id, createdAt: t.created_at });
      }
    }
  }

  const lineCountByTranscript = new Map<string, number>();
  const transcriptIds = [...transcriptByVideo.values()].map((t) => t.id);
  if (transcriptIds.length > 0) {
    const { data: lines, error: linesError } = await service
      .from("transcript_lines")
      .select("transcript_id")
      .in("transcript_id", transcriptIds);
    if (linesError) throw linesError;
    for (const line of (lines as { transcript_id: string }[]) ?? []) {
      lineCountByTranscript.set(line.transcript_id, (lineCountByTranscript.get(line.transcript_id) ?? 0) + 1);
    }
  }

  const items: PendingVideoListItem[] = page.map((v) => {
    const transcript = transcriptByVideo.get(v.id);
    return {
      ...v,
      importerName: v.added_by_user_id ? (importerNames.get(v.added_by_user_id) ?? null) : null,
      hasTranscript: transcript !== undefined,
      transcriptLineCount: transcript ? (lineCountByTranscript.get(transcript.id) ?? 0) : 0,
    };
  });

  const nextCursor = hasMore ? (page[page.length - 1]?.created_at ?? null) : null;
  return { ok: true, data: { items, nextCursor } };
}

export type PromoteVideoResult =
  | { ok: true; data: { id: string; library_access: "FREE" | "PLUS" } }
  | GuardFailure
  | { ok: false; status: 404 | 422 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Promote a PRIVATE lesson to FREE or PLUS. Requires a transcript to already
 * exist (spec §4.1 — "a lesson only reaches FREE/PLUS with a transcript
 * already attached," decided 2026-07-31): otherwise a published lesson could
 * have no studyable content, which the domain model treats as impossible.
 */
export async function promoteVideo(id: string, tier: "FREE" | "PLUS"): Promise<PromoteVideoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:videos:promote:${admin.user.id}`, APPROVE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const service = createServiceClient();
  const { data: transcripts, error: transcriptError } = await service
    .from("transcripts")
    .select("id")
    .eq("video_id", id);
  if (transcriptError) throw transcriptError;
  if (((transcripts as { id: string }[] | null) ?? []).length === 0) {
    return { ok: false, status: 422 };
  }

  const { data, error } = await service
    .from("videos")
    .update({ library_access: tier })
    .eq("id", id)
    .eq("library_access", "PRIVATE")
    .select("id, library_access")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: data as { id: string; library_access: "FREE" | "PLUS" } };
}

export type DemoteVideoResult =
  | { ok: true; data: { id: string; library_access: "PRIVATE" } }
  | GuardFailure
  | { ok: false; status: 404 };

/** Demote a published lesson back to PRIVATE (spec §4.2 "management" view). */
export async function demoteVideo(id: string): Promise<DemoteVideoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .update({ library_access: "PRIVATE" })
    .eq("id", id)
    .select("id, library_access")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: data as { id: string; library_access: "PRIVATE" } };
}

export type StarVideoResult =
  | { ok: true; data: { id: string; promotion_starred: boolean } }
  | GuardFailure
  | { ok: false; status: 404 };

/** Toggle a PRIVATE lesson's "Ready to Promote" shortlist flag (spec §4.2). */
export async function starVideo(id: string, starred: boolean): Promise<StarVideoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .update({ promotion_starred: starred })
    .eq("id", id)
    .select("id, promotion_starred")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: data as { id: string; promotion_starred: boolean } };
}

export type RejectVideoResult =
  | { ok: true; data: { id: string } }
  | GuardFailure
  | { ok: false; status: 404 }
  | { ok: false; status: 409 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Reject a PRIVATE lesson. `lesson_access_level` (migration
 * 20260731000017_lesson_access_level.sql) is only `'PRIVATE' | 'FREE' |
 * 'PLUS'` — there is no `'rejected'` value to flip to, and adding one is a
 * schema change out of scope here (owned by `database-engineer`; no
 * migration added per this task's constraints). Reject is therefore
 * implemented as a hard DELETE of the video row via the service role, which
 * cascades to `transcripts`/`transcript_lines`/`user_video_progress`/
 * `user_playlist_items`/`user_lesson_library` (all `on delete cascade`) and
 * nulls out `video_id` on `shadowing_sessions`/`dictation_attempts` and
 * `source_video_id` on `vocab_examples` (all `on delete set null`) — see
 * migration 20260712000001_schema.sql for the FK definitions.
 *
 * `reason` is accepted for the moderator's own record (logged server-side)
 * but is NOT persisted anywhere — there is no row left to attach it to after
 * delete, and no `rejected_videos`-style audit table exists.
 *
 * SAFETY GUARD (final whole-branch review, 2026-08-01): under the old
 * `status` model this only ever deleted an unapproved 'pending' submission
 * with essentially zero investment. Under `library_access`, every user
 * import defaults to `PRIVATE`, so this same hard-delete could otherwise
 * destroy a lesson someone is actively studying. A lesson only gets a
 * `user_lesson_library` row once its creator's own Create Lesson pipeline
 * confirms a transcript exists, so "zero library rows" reliably means
 * "orphaned, never became studyable" — reject refuses (409) whenever ANY
 * user (not just the video's creator) already holds the lesson in their
 * library.
 *
 * OPEN ITEM (flagged in the Layer 7 handoff rather than resolved here): a
 * genuine `'rejected'` status — keeping the row, hiding it from
 * `videos_read`, and storing `reason` — would give an audit trail and let a
 * submitter see why their video was rejected. Recommend a follow-up
 * migration from `database-engineer` if that's wanted; this delete-based
 * reject is the pragmatic fit for the schema as it exists today.
 */
export async function rejectVideo(id: string, reason?: string): Promise<RejectVideoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:videos:reject:${admin.user.id}`, REJECT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const service = createServiceClient();

  // Safety guard (final whole-branch review, 2026-08-01): refuse to
  // hard-delete a lesson that ANY user (not just its creator) already holds
  // in their personal library — see the doc comment above for why "zero
  // library rows" is the correct signal for "safe to delete."
  const { data: libraryRows, error: libraryError } = await service
    .from("user_lesson_library")
    .select("user_id")
    .eq("lesson_id", id);
  if (libraryError) throw libraryError;
  if (((libraryRows as { user_id: string }[] | null) ?? []).length > 0) {
    return { ok: false, status: 409 };
  }

  if (reason) {
    // eslint-disable-next-line no-console -- deliberate moderation audit log; not persisted anywhere else (see doc comment above).
    console.log(`[admin] video ${id} rejected by ${admin.user.email}: ${reason}`);
  }

  const { data, error } = await service
    .from("videos")
    .delete()
    .eq("id", id)
    .eq("library_access", "PRIVATE")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: { id: (data as { id: string }).id } };
}

export interface PromotionScoreInputs {
  libraryCount: number;
  studySessionCount: number;
  completedCount: number;
}

/**
 * Initial Promotion Score weights (spec §4.2 explicitly leaves these as an
 * implementation-time decision, not fixed). Bookmark count is OMITTED: no
 * `bookmarks` table exists anywhere in this schema yet, so there is nothing
 * to weigh — add it here if/when a bookmarks feature ships.
 */
export function computePromotionScore(inputs: PromotionScoreInputs): number {
  return inputs.libraryCount * 3 + inputs.studySessionCount * 1 + inputs.completedCount * 2;
}

/**
 * Cap on how many PRIVATE lessons `listTrendingLessons` scores in one call.
 * Every new user import defaults to PRIVATE now (not a small moderation
 * queue like the old pending-only model), so the driving query is unbounded
 * by construction without this — an unbounded row set would also blow past
 * PostgREST's server-side row cap on the four `.in()` follow-up queries,
 * silently truncating and mis-ranking scores rather than erroring. 200 is a
 * tunable starting point, not a precisely-derived number.
 */
const TRENDING_LESSON_LIMIT = 200;

export type ListTrendingResult = { ok: true; data: (PendingVideoRow & { score: number })[] } | GuardFailure;

/** PRIVATE lessons ranked by Promotion Score, highest first (spec §4.2). */
export async function listTrendingLessons(): Promise<ListTrendingResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data: privateLessons, error } = await service
    .from("videos")
    .select(PENDING_COLUMNS)
    .eq("library_access", "PRIVATE")
    .limit(TRENDING_LESSON_LIMIT);
  if (error) throw error;

  const lessons = (privateLessons as PendingVideoRow[]) ?? [];
  const lessonIds = lessons.map((l) => l.id);
  if (lessonIds.length === 0) return { ok: true, data: [] };

  const [libraryRes, shadowingRes, dictationRes, progressRes] = await Promise.all([
    service.from("user_lesson_library").select("lesson_id").in("lesson_id", lessonIds),
    service.from("shadowing_sessions").select("video_id").in("video_id", lessonIds),
    service.from("dictation_attempts").select("video_id").in("video_id", lessonIds),
    service.from("user_video_progress").select("video_id, completed_at").in("video_id", lessonIds),
  ]);
  if (libraryRes.error) throw libraryRes.error;
  if (shadowingRes.error) throw shadowingRes.error;
  if (dictationRes.error) throw dictationRes.error;
  if (progressRes.error) throw progressRes.error;

  const countBy = (rows: { lesson_id?: string; video_id?: string }[], key: "lesson_id" | "video_id") => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const id = row[key];
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };

  const libraryCounts = countBy((libraryRes.data as { lesson_id: string }[]) ?? [], "lesson_id");
  const shadowingCounts = countBy((shadowingRes.data as { video_id: string }[]) ?? [], "video_id");
  const dictationCounts = countBy((dictationRes.data as { video_id: string }[]) ?? [], "video_id");
  const completedCounts = countBy(
    ((progressRes.data as { video_id: string; completed_at: string | null }[]) ?? []).filter((r) => r.completed_at),
    "video_id",
  );

  const scored = lessons.map((lesson) => ({
    ...lesson,
    score: computePromotionScore({
      libraryCount: libraryCounts.get(lesson.id) ?? 0,
      studySessionCount: (shadowingCounts.get(lesson.id) ?? 0) + (dictationCounts.get(lesson.id) ?? 0),
      completedCount: completedCounts.get(lesson.id) ?? 0,
    }),
  }));
  scored.sort((a, b) => b.score - a.score);

  return { ok: true, data: scored };
}

export type ListReadyToPromoteResult = { ok: true; data: PendingVideoRow[] } | GuardFailure;

/** Admin's own starred shortlist of PRIVATE lessons (spec §4.2). */
export async function listReadyToPromote(): Promise<ListReadyToPromoteResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .select(PENDING_COLUMNS)
    .eq("library_access", "PRIVATE")
    .eq("promotion_starred", true);
  if (error) throw error;

  return { ok: true, data: (data as PendingVideoRow[]) ?? [] };
}

export type ListPublishedResult = { ok: true; data: PendingVideoRow[] } | GuardFailure;

/** FREE/PLUS lessons, for re-tier/demote management (spec §4.2). */
export async function listPublishedLessons(): Promise<ListPublishedResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .select(PENDING_COLUMNS)
    .in("library_access", ["FREE", "PLUS"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  return { ok: true, data: (data as PendingVideoRow[]) ?? [] };
}

export type ReplaceTranscriptResult =
  | { ok: true; data: { transcriptId: string; lineCount: number } }
  | GuardFailure
  | { ok: false; status: 404 | 422 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Replace a video's transcript entirely: delete any existing transcript
 * (cascades its lines) and insert a freshly parsed one. Parsing goes through
 * the same `lib/transcript` pipeline as the owner-submitted ingest path
 * (`lib/data/transcripts.ts::saveTranscript`) — sanitized (anti-XSS) inside
 * `parseTranscript` itself, so no separate sanitize step is needed here.
 *
 * `transcript_source` (migration 20260712000001_schema.sql) is
 * `'youtube_caption' | 'user_submitted' | 'ai_generated'` — there is no
 * `'admin'` value. `'user_submitted'` is the closest existing fit (it is, in
 * fact, submitted by a person rather than auto-captions or STT/AI), and is
 * used here. OPEN ITEM: an `'admin'` enum value would make the provenance of
 * a moderator-attached transcript explicit for future audits/analytics;
 * flagged rather than added (no migration in this task's scope).
 */
export async function replaceVideoTranscript(
  videoId: string,
  input: { format: TranscriptFormat; content: string },
): Promise<ReplaceTranscriptResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:videos:transcript:${admin.user.id}`, TRANSCRIPT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const service = createServiceClient();
  const { data: video, error: videoError } = await service.from("videos").select("id").eq("id", videoId).maybeSingle();
  if (videoError) throw videoError;
  if (!video) return { ok: false, status: 404 };

  const parsedLines = parseTranscript(input.content, input.format);
  if (parsedLines.length === 0 || parsedLines.length > MAX_TRANSCRIPT_LINES) {
    return { ok: false, status: 422 };
  }

  const { error: deleteError } = await service.from("transcripts").delete().eq("video_id", videoId);
  if (deleteError) throw deleteError;

  const { data: transcript, error: insertError } = await service
    .from("transcripts")
    .insert({ video_id: videoId, source: "user_submitted", language: "ja" })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const transcriptId = (transcript as { id: string }).id;

  const linesWithFurigana = [];
  for (const line of parsedLines) {
    let furigana: unknown = null;
    try {
      furigana = await toFurigana(line.textJp);
    } catch (err) {
      // Best-effort, same posture as lib/data/reading.ts::ensureFurigana —
      // a tokenizer hiccup must not fail the whole transcript attach.
      console.error(`[admin] furigana generation failed for a transcript line on video ${videoId}:`, err);
    }
    linesWithFurigana.push({
      transcript_id: transcriptId,
      start_time: line.startTime,
      end_time: line.endTime,
      text_jp: line.textJp,
      text_translation: line.textTranslation ?? null,
      furigana_json: furigana,
    });
  }

  const { error: linesError } = await service.from("transcript_lines").insert(linesWithFurigana);
  if (linesError) throw linesError;

  return { ok: true, data: { transcriptId, lineCount: linesWithFurigana.length } };
}
