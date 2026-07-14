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
  "id, youtube_video_id, title, duration_seconds, thumbnail_url, jlpt_level_estimate, added_by_user_id, created_at";

interface PendingVideoRow {
  id: string;
  youtube_video_id: string;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  jlpt_level_estimate: string | null;
  added_by_user_id: string | null;
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
export async function listPendingVideos(cursor?: string): Promise<ListPendingVideosResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  let query = service
    .from("videos")
    .select(PENDING_COLUMNS)
    .eq("status", "pending")
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

export type ApproveVideoResult =
  | { ok: true; data: { id: string; status: "approved" } }
  | GuardFailure
  | { ok: false; status: 404 }
  | { ok: false; status: 429; retryAfter: number };

/** Approve a pending video (`videos.status: 'pending' -> 'approved'`). The
 * `.eq("status", "pending")` guard makes this idempotent-safe: re-approving
 * an already-approved id, or approving a nonexistent id, both come back as a
 * plain 404 rather than a silent no-op update. */
export async function approveVideo(id: string): Promise<ApproveVideoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:videos:approve:${admin.user.id}`, APPROVE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: data as { id: string; status: "approved" } };
}

export type RejectVideoResult =
  | { ok: true; data: { id: string } }
  | GuardFailure
  | { ok: false; status: 404 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Reject a pending video. `video_status` (migration
 * 20260712000001_schema.sql) is only `'pending' | 'approved'` — there is no
 * `'rejected'` value to flip to, and adding one is a schema change out of
 * scope here (owned by `database-engineer`; no migration added per this
 * task's constraints). Reject is therefore implemented as a hard DELETE of
 * the video row via the service role, which cascades to
 * `transcripts`/`transcript_lines`/`user_video_progress`/
 * `user_playlist_items` (all `on delete cascade`) and nulls out `video_id` on
 * `shadowing_sessions`/`dictation_attempts` and `source_video_id` on
 * `vocab_examples` (all `on delete set null`) — see that schema migration for
 * the FK definitions.
 *
 * `reason` is accepted for the moderator's own record (logged server-side)
 * but is NOT persisted anywhere — there is no row left to attach it to after
 * delete, and no `rejected_videos`-style audit table exists.
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

  if (reason) {
    // eslint-disable-next-line no-console -- deliberate moderation audit log; not persisted anywhere else (see doc comment above).
    console.log(`[admin] video ${id} rejected by ${admin.user.email}: ${reason}`);
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .delete()
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: { id: (data as { id: string }).id } };
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
