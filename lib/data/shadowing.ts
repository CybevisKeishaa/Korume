import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/data/gamification";
import { validateAudioFile, type AudioFileLike } from "@/lib/validation/shadowing";

const SESSION_LIMIT = { limit: 30, windowMs: 60_000 };
/** Long enough for the recorder UI to hand the clip straight back for playback. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const RECENT_SESSIONS_LIMIT = 10;
const BUCKET = "recordings";

export interface CreateSessionInput {
  videoId: string;
  lineId: string;
  audio: Blob;
  /** Self-reported pitch-accent score (0-100), already validated/clamped by
   * `shadowingSessionSchema` — see `lib/validation/shadowing.ts`. */
  pitchScore?: number;
}

export type CreateSessionResult =
  | { ok: true; data: { id: string; recordingPath: string; signedUrl: string; createdAt: string } }
  | { ok: false; status: 401 | 400 | 422 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Persist one shadowing recording for the current user: rate-limit, validate
 * the audio blob, upload it to the private `recordings` bucket at
 * `${user.id}/shadowing/${sessionId}.webm` — the RLS insert policy on
 * `storage.objects` requires that exact prefix (CLAUDE.md §2: recordings
 * belong to the user, encrypted at rest, never public) — insert the
 * `shadowing_sessions` row, and return a short-lived signed URL for
 * immediate playback. `pronunciation_score`/`rhythm_score` are left null here
 * — they're filled in later by `POST /api/pronunciation/score` (Azure
 * scoring). `pitch_score` is accepted directly at creation when supplied:
 * it's computed client-side (`lib/pitch`) from the same recording before
 * upload, so no separate round-trip is needed to attach it.
 */
export async function createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`shadowing:session:${user.id}`, SESSION_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const audioMeta: AudioFileLike = { size: input.audio.size, type: input.audio.type };
  const validation = validateAudioFile(audioMeta);
  if (!validation.ok) return { ok: false, status: 422 };

  const sessionId = randomUUID();
  const recordingPath = `${user.id}/shadowing/${sessionId}.webm`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(recordingPath, input.audio, { contentType: input.audio.type, upsert: false });
  if (uploadError) return { ok: false, status: 400 };

  const { data: inserted, error: insertError } = await supabase
    .from("shadowing_sessions")
    .insert({
      id: sessionId,
      user_id: user.id,
      video_id: input.videoId,
      transcript_line_id: input.lineId,
      recording_url: recordingPath,
      ...(input.pitchScore !== undefined ? { pitch_score: input.pitchScore } : {}),
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    // Bad videoId/lineId (FK violation) or other write failure — don't leave
    // an orphaned object behind, and surface as 400 rather than a 500 leak.
    await supabase.storage.from(BUCKET).remove([recordingPath]);
    return { ok: false, status: 400 };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(recordingPath, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) return { ok: false, status: 400 };

  // Best-effort: gamification never fails a learning-flow request (see
  // lib/data/gamification.ts::recordActivity).
  await recordActivity({ userId: user.id, source: "shadowing", parts: { lineId: input.lineId } });

  const row = inserted as { id: string; created_at: string };
  return {
    ok: true,
    data: { id: row.id, recordingPath, signedUrl: signed.signedUrl, createdAt: row.created_at },
  };
}

export interface SessionListItem {
  id: string;
  createdAt: string;
  signedUrl: string;
}

export type ListSessionsResult = { ok: true; data: SessionListItem[] } | { ok: false; status: 401 };

/**
 * The current user's most recent shadowing recordings for one transcript
 * line, newest first, each with a freshly signed URL for replay (signed URLs
 * expire, so they can't be cached across requests).
 */
export async function listSessions(lineId: string): Promise<ListSessionsResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data: rows, error } = await supabase
    .from("shadowing_sessions")
    .select("id, recording_url, created_at")
    .eq("user_id", user.id)
    .eq("transcript_line_id", lineId)
    .order("created_at", { ascending: false })
    .limit(RECENT_SESSIONS_LIMIT);
  if (error) throw error;

  const typedRows = (rows ?? []) as { id: string; recording_url: string | null; created_at: string }[];

  // Sign in parallel rather than N+1 sequentially; row order (newest-first,
  // from the query above) is preserved since each promise keeps its index.
  const signedResults = await Promise.all(
    typedRows.map(async (row) => {
      if (!row.recording_url) return null;
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.recording_url, SIGNED_URL_TTL_SECONDS);
      if (!signed) return null;
      return { id: row.id, createdAt: row.created_at, signedUrl: signed.signedUrl };
    }),
  );

  const sessions = signedResults.filter((s): s is SessionListItem => s !== null);

  return { ok: true, data: sessions };
}
