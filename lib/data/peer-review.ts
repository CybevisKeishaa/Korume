import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeTranscriptText } from "@/lib/transcript/sanitize";
import type { CreateReviewInput, CreateShareInput, PeerReviewQueueQuery } from "@/lib/validation/peer-review";

/**
 * Shadowing peer review (CLAUDE.md §2/§5: recordings belong to the user and
 * are private by default; a `peer_review_shares` row IS the owner's explicit,
 * revocable consent to let other signed-in users hear ONE recording — see
 * migration 20260714000014_community_admin.sql for the full rationale).
 * `getShareAudioUrl` is the ONLY read path into another user's recording
 * audio, and only for sessions that have an active share row; deleting the
 * share revokes consent immediately (no new signed URL can be minted after).
 *
 * G1 (docs/product/business-model.md §1.1): sharing/reviewing is NOT a
 * learning outcome — this module never calls `recordActivity`.
 */

const SHARE_CREATE_LIMIT = { limit: 20, windowMs: 60_000 };
const SHARE_MODIFY_LIMIT = { limit: 30, windowMs: 60_000 };
const REVIEW_CREATE_LIMIT = { limit: 30, windowMs: 60_000 };
/** The signed-URL mint is an amplification surface (each call is a fresh,
 * short-lived credential into someone else's private recording) — rate-limit
 * tightly. */
const AUDIO_MINT_LIMIT = { limit: 20, windowMs: 60_000 };

const RECORDINGS_BUCKET = "recordings";
const SIGNED_URL_TTL_SECONDS = 5 * 60;

export interface PeerReviewAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Batch-resolve {id, name, avatar_url} via the service role — `users_select_own`
 * confines the normal client to the caller's own row. NEVER selects `email`.
 * Duplicated (not shared) across the four Layer 7 community `lib/data/*`
 * files deliberately — see `lib/data/forum.ts::fetchAuthors` for the same note.
 */
async function fetchAuthors(userIds: string[]): Promise<Map<string, PeerReviewAuthor>> {
  const uniqueIds = Array.from(new Set(userIds));
  const map = new Map<string, PeerReviewAuthor>();
  if (uniqueIds.length === 0) return map;

  const service = createServiceClient();
  const { data, error } = await service.from("users").select("id, name, avatar_url").in("id", uniqueIds);
  if (error) throw error;
  for (const row of (data as { id: string; name: string | null; avatar_url: string | null }[]) ?? []) {
    map.set(row.id, { id: row.id, name: row.name, avatarUrl: row.avatar_url });
  }
  return map;
}

export type CreateShareResult =
  | { ok: true; data: { id: string; createdAt: string } }
  | { ok: false; status: 401 | 400 | 404 }
  | { ok: false; status: 409 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Share one of the caller's OWN shadowing sessions into the peer-review
 * queue. `line_text` is denormalized server-side from the session's
 * `transcript_line_id` at share time (never trusted from the client) — a
 * session with no recording, or no linked transcript line, cannot be shared.
 */
export async function createShare(input: CreateShareInput, now: Date = new Date()): Promise<CreateShareResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`peer-review:share:create:${user.id}`, SHARE_CREATE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: session, error: sessionError } = await supabase
    .from("shadowing_sessions")
    .select("id, recording_url, transcript_line_id")
    .eq("id", input.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return { ok: false, status: 404 };

  const sessionRow = session as { id: string; recording_url: string | null; transcript_line_id: string | null };
  if (!sessionRow.recording_url || !sessionRow.transcript_line_id) return { ok: false, status: 400 };

  const { data: line, error: lineError } = await supabase
    .from("transcript_lines")
    .select("text_jp")
    .eq("id", sessionRow.transcript_line_id)
    .maybeSingle();
  if (lineError) throw lineError;
  if (!line) return { ok: false, status: 400 };

  const { data: inserted, error: insertError } = await supabase
    .from("peer_review_shares")
    .insert({
      session_id: input.sessionId,
      user_id: user.id,
      line_text: (line as { text_jp: string }).text_jp,
      note: input.note !== undefined ? sanitizeTranscriptText(input.note) : null,
    })
    .select("id, created_at")
    .single();
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, status: 409 };
    return { ok: false, status: 400 };
  }

  const row = inserted as { id: string; created_at: string };
  return { ok: true, data: { id: row.id, createdAt: row.created_at } };
}

export type DeleteShareResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

/** Revoke consent: deleting the share row cascades to any reviews written against it. */
export async function deleteShare(id: string, now: Date = new Date()): Promise<DeleteShareResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`peer-review:share:modify:${user.id}`, SHARE_MODIFY_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase.from("peer_review_shares").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true };
}

interface ShareRow {
  id: string;
  session_id: string;
  user_id: string;
  line_text: string;
  note: string | null;
  created_at: string;
}

export interface PeerReviewShareListItem {
  id: string;
  sessionId: string;
  lineText: string;
  note: string | null;
  createdAt: string;
  sharedBy: PeerReviewAuthor | null;
  reviewCount: number;
  alreadyReviewed: boolean;
}

export interface PeerReviewQueuePage {
  shares: PeerReviewShareListItem[];
  nextCursor: string | null;
}

export type ListQueueResult = { ok: true; data: PeerReviewQueuePage } | { ok: false; status: 401 };

/** Shares awaiting review, newest first, EXCLUDING the caller's own shares. */
export async function listQueue(query: PeerReviewQueueQuery): Promise<ListQueueResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  let dbQuery = supabase
    .from("peer_review_shares")
    .select("id, session_id, user_id, line_text, note, created_at")
    .neq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(query.limit);
  if (query.cursor) dbQuery = dbQuery.lt("created_at", query.cursor);

  const { data, error } = await dbQuery;
  if (error) throw error;
  const rows = (data as ShareRow[]) ?? [];

  const shareIds = rows.map((r) => r.id);
  const [reviewStats, authors] = await Promise.all([
    fetchReviewStats(supabase, shareIds, user.id),
    fetchAuthors(rows.map((r) => r.user_id)),
  ]);

  const shares: PeerReviewShareListItem[] = rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    lineText: row.line_text,
    note: row.note,
    createdAt: row.created_at,
    sharedBy: authors.get(row.user_id) ?? null,
    reviewCount: reviewStats.counts.get(row.id) ?? 0,
    alreadyReviewed: reviewStats.reviewedByMe.has(row.id),
  }));

  const nextCursor = rows.length === query.limit ? (rows[rows.length - 1]?.created_at ?? null) : null;
  return { ok: true, data: { shares, nextCursor } };
}

async function fetchReviewStats(
  supabase: ReturnType<typeof createClient>,
  shareIds: string[],
  callerId: string,
): Promise<{ counts: Map<string, number>; reviewedByMe: Set<string> }> {
  const counts = new Map<string, number>();
  const reviewedByMe = new Set<string>();
  if (shareIds.length === 0) return { counts, reviewedByMe };

  const { data, error } = await supabase.from("peer_reviews").select("share_id, reviewer_id").in("share_id", shareIds);
  if (error) throw error;
  for (const row of (data as { share_id: string; reviewer_id: string }[]) ?? []) {
    counts.set(row.share_id, (counts.get(row.share_id) ?? 0) + 1);
    if (row.reviewer_id === callerId) reviewedByMe.add(row.share_id);
  }
  return { counts, reviewedByMe };
}

export type GetShareAudioUrlResult =
  | { ok: true; data: { signedUrl: string; expiresInSeconds: number } }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Mint a short-lived (~5 min) signed URL for a shared recording's audio,
 * ONLY when a `peer_review_shares` row exists for the underlying session.
 * `shadowing_sessions` is owner-only RLS (`shadowing_own`), so a reviewer who
 * is NOT the recording's owner cannot read `recording_url` via the normal
 * client — the service role is required here, deliberately, and only after
 * confirming the share (i.e. consent) exists via the normal (RLS-scoped)
 * client first.
 */
export async function getShareAudioUrl(shareId: string, now: Date = new Date()): Promise<GetShareAudioUrlResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`peer-review:audio:${user.id}`, AUDIO_MINT_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: share, error: shareError } = await supabase.from("peer_review_shares").select("id, session_id").eq("id", shareId).maybeSingle();
  if (shareError) throw shareError;
  if (!share) return { ok: false, status: 404 };

  const service = createServiceClient();
  const { data: session, error: sessionError } = await service
    .from("shadowing_sessions")
    .select("recording_url")
    .eq("id", (share as { session_id: string }).session_id)
    .maybeSingle();
  if (sessionError) throw sessionError;
  const recordingUrl = (session as { recording_url: string | null } | null)?.recording_url;
  if (!recordingUrl) return { ok: false, status: 404 };

  const { data: signed, error: signError } = await service.storage.from(RECORDINGS_BUCKET).createSignedUrl(recordingUrl, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) return { ok: false, status: 404 };

  return { ok: true, data: { signedUrl: (signed as { signedUrl: string }).signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS } };
}

export type CreateReviewResult =
  | { ok: true; data: { id: string; createdAt: string } }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 403 }
  | { ok: false; status: 409 }
  | { ok: false; status: 429; retryAfter: number };

export async function createReview(
  shareId: string,
  input: CreateReviewInput,
  now: Date = new Date(),
): Promise<CreateReviewResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`peer-review:review:create:${user.id}`, REVIEW_CREATE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: share, error: shareError } = await supabase.from("peer_review_shares").select("id, user_id").eq("id", shareId).maybeSingle();
  if (shareError) throw shareError;
  if (!share) return { ok: false, status: 404 };

  const shareRow = share as { id: string; user_id: string };
  // Reject self-review early with a clean error, ahead of the RLS backstop
  // (`peer_reviews_insert`'s `not exists` clause) — see migration
  // 20260714000014_community_admin.sql.
  if (shareRow.user_id === user.id) return { ok: false, status: 403 };

  const { data: inserted, error: insertError } = await supabase
    .from("peer_reviews")
    .insert({
      share_id: shareId,
      reviewer_id: user.id,
      rating: input.rating,
      comment: sanitizeTranscriptText(input.comment),
    })
    .select("id, created_at")
    .single();
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, status: 409 };
    return { ok: false, status: 404 };
  }

  const row = inserted as { id: string; created_at: string };
  return { ok: true, data: { id: row.id, createdAt: row.created_at } };
}

export interface PeerReviewReceived {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: PeerReviewAuthor | null;
}

export interface MyShareWithReviews {
  id: string;
  sessionId: string;
  lineText: string;
  note: string | null;
  createdAt: string;
  reviews: PeerReviewReceived[];
}

export type ListMineResult = { ok: true; data: MyShareWithReviews[] } | { ok: false; status: 401 };

/** The caller's own shares, each with the reviews received so far. */
export async function listMine(): Promise<ListMineResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data: shares, error: sharesError } = await supabase
    .from("peer_review_shares")
    .select("id, session_id, user_id, line_text, note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (sharesError) throw sharesError;
  const shareRows = (shares as ShareRow[]) ?? [];

  const shareIds = shareRows.map((s) => s.id);
  const reviewRows = await fetchReviewsForShares(supabase, shareIds);
  const authors = await fetchAuthors(reviewRows.map((r) => r.reviewer_id));

  const reviewsByShare = new Map<string, PeerReviewReceived[]>();
  for (const row of reviewRows) {
    const list = reviewsByShare.get(row.share_id) ?? [];
    list.push({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
      reviewer: authors.get(row.reviewer_id) ?? null,
    });
    reviewsByShare.set(row.share_id, list);
  }

  return {
    ok: true,
    data: shareRows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      lineText: row.line_text,
      note: row.note,
      createdAt: row.created_at,
      reviews: reviewsByShare.get(row.id) ?? [],
    })),
  };
}

interface ReviewRow {
  id: string;
  share_id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

async function fetchReviewsForShares(supabase: ReturnType<typeof createClient>, shareIds: string[]): Promise<ReviewRow[]> {
  if (shareIds.length === 0) return [];
  const { data, error } = await supabase
    .from("peer_reviews")
    .select("id, share_id, reviewer_id, rating, comment, created_at")
    .in("share_id", shareIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ReviewRow[]) ?? [];
}
