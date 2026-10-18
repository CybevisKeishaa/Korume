import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { inspectWav, WAV_MAX_BYTES } from "@/lib/audio/wav-header";
import { readAssessment, type Assessment } from "@/lib/pronunciation/assessment";
import { rateLimit } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/data/gamification";
import { claimActiveMission, ensureDailyMission } from "@/lib/data/missions";

const SESSION_LIMIT = { limit: 30, windowMs: 60_000 };
/** Long enough for the recorder UI to hand the clip straight back for playback. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const RECENT_SESSIONS_LIMIT = 10;
const BUCKET = "recordings";
const SCORING_LEASE_MS = 90_000;

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
 * WAV bytes, upload them to the private `recordings` bucket at
 * `${user.id}/shadowing/${sessionId}.wav` using storage RLS, then insert the
 * `shadowing_sessions` row through the service client after verifying the
 * user and line relation (practice modes spec D25). Return a signed URL for
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

  if (input.audio.size > WAV_MAX_BYTES) return { ok: false, status: 422 };
  const bytes = new Uint8Array(await input.audio.arrayBuffer());
  if (!inspectWav(bytes).ok) return { ok: false, status: 422 };
  const { data: line, error: lineError } = await supabase
    .from("transcript_lines")
    .select("id, transcripts!inner(video_id)")
    .eq("id", input.lineId)
    .eq("transcripts.video_id", input.videoId)
    .maybeSingle();
  if (lineError) throw lineError;
  if (!line) return { ok: false, status: 400 };
  try {
    await ensureDailyMission(user.id);
  } catch (err) {
    console.error("[missions] ensure before shadowing failed:", err);
  }

  const sessionId = randomUUID();
  const recordingPath = `${user.id}/shadowing/${sessionId}.wav`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(recordingPath, bytes, { contentType: "audio/wav", upsert: false });
  if (uploadError) return { ok: false, status: 400 };

  const { data: inserted, error: insertError } = await createServiceClient()
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
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([recordingPath]);
    if (removeError) console.error("[shadowing] orphaned recording after a failed insert:", recordingPath, removeError);
    return { ok: false, status: 400 };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(recordingPath, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) return { ok: false, status: 400 };

  // Best-effort: gamification never fails a learning-flow request (see
  // lib/data/gamification.ts::recordActivity).
  await recordActivity({ userId: user.id, source: "shadowing", parts: { lineId: input.lineId } });
  await claimActiveMission(user.id);

  const row = inserted as { id: string; created_at: string };
  return {
    ok: true,
    data: { id: row.id, recordingPath, signedUrl: signed.signedUrl, createdAt: row.created_at },
  };
}

export interface SessionListItem {
  id: string;
  createdAt: string;
  signedUrl: string | null;
  pronunciationScore: number | null;
  rhythmScore: number | null;
  pitchScore: number | null;
  assessment: Assessment | null;
  state: "scored" | "scoring" | "unscored" | "legacy";
  format: "wav" | "webm";
}

interface SessionRow {
  id: string;
  created_at: string;
  recording_url: string | null;
  pronunciation_score: number | null;
  rhythm_score: number | null;
  pitch_score: number | null;
  assessment: unknown;
  scoring_claim: string | null;
  scoring_started_at: string | null;
}

function sessionState(row: SessionRow, now: number): SessionListItem["state"] {
  if (row.pronunciation_score !== null) return "scored";
  if (row.recording_url?.endsWith(".webm")) return "legacy";
  const started = row.scoring_started_at === null ? Number.NaN : Date.parse(row.scoring_started_at);
  return row.scoring_claim !== null && now - started < SCORING_LEASE_MS ? "scoring" : "unscored";
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
    .select("id, recording_url, created_at, pronunciation_score, rhythm_score, pitch_score, assessment, scoring_claim, scoring_started_at")
    .eq("user_id", user.id)
    .eq("transcript_line_id", lineId)
    .order("created_at", { ascending: false })
    .limit(RECENT_SESSIONS_LIMIT);
  if (error) throw error;

  const typedRows = (rows ?? []) as SessionRow[];
  const now = Date.now();

  // Sign in parallel rather than N+1 sequentially; row order (newest-first,
  // from the query above) is preserved since each promise keeps its index.
  const sessions = await Promise.all(
    typedRows.map(async (row): Promise<SessionListItem> => {
      const signed = row.recording_url
        ? await supabase.storage.from(BUCKET).createSignedUrl(row.recording_url, SIGNED_URL_TTL_SECONDS)
        : null;
      return {
        id: row.id, createdAt: row.created_at,
        signedUrl: signed?.error ? null : signed?.data?.signedUrl ?? null,
        pronunciationScore: row.pronunciation_score, rhythmScore: row.rhythm_score, pitchScore: row.pitch_score,
        assessment: readAssessment(row.assessment), state: sessionState(row, now),
        format: row.recording_url?.endsWith(".webm") ? "webm" : "wav",
      };
    }),
  );

  return { ok: true, data: sessions };
}
