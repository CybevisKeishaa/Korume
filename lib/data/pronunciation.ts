import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import {
  assessPronunciation,
  isSpeechConfigured,
  SpeechError,
  type PronunciationAssessmentResult,
} from "@/lib/speech-scoring";
import { speechErrorStatus, SPEECH_THROTTLE_RETRY_AFTER_MS } from "@/lib/http-status";
import { validateAudioSize } from "@/lib/validation/audio";
import { captureShadowScoreMemories } from "@/lib/data/companion";

/**
 * Pronunciation scoring (differentiator #1 support, CLAUDE.md §5). The most
 * quota-sensitive AI/speech endpoint — tightly rate-limited (10/min/user).
 */
const SCORE_LIMIT = { limit: 10, windowMs: 60_000 };

export interface ScorePronunciationInput {
  audio: Blob;
  referenceText: string;
  /** When present, the scores are persisted onto this (owned) session row. */
  shadowingSessionId?: string;
}

/** The caller's own session row, as selected by the ownership lookup. */
interface OwnedSession {
  id: string;
  video_id: string | null;
  transcript_line_id: string | null;
}

export type ScorePronunciationResult =
  | { ok: true; data: PronunciationAssessmentResult }
  | { ok: false; status: 401 | 404 | 422 | 502 | 503 }
  // Our own limiter OR Azure's own throttle — merged so `status === 429`
  // narrows to one shape with retryAfter always present in practice.
  | { ok: false; status: 429; retryAfter: number };

/**
 * Score a recorded line against `referenceText` via Azure Speech, and — when
 * `shadowingSessionId` is supplied — persist `pronunciationScore`/
 * `fluencyScore` onto the caller's own `shadowing_sessions` row (verified by
 * ownership lookup first; a session id that isn't the caller's own is a 404,
 * not a silent no-op).
 */
export async function scorePronunciation(
  input: ScorePronunciationInput,
): Promise<ScorePronunciationResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`pronunciation:score:${user.id}`, SCORE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  if (!isSpeechConfigured()) return { ok: false, status: 503 };

  const sizeCheck = validateAudioSize({ size: input.audio.size });
  if (!sizeCheck.ok) return { ok: false, status: 422 };

  // Kept beyond the ownership check: the Companion capture below needs the
  // session's video/line pointers, and this is the only lookup that has them.
  let ownedSession: OwnedSession | null = null;
  if (input.shadowingSessionId) {
    const { data: session, error: lookupError } = await supabase
      .from("shadowing_sessions")
      .select("id, video_id, transcript_line_id")
      .eq("id", input.shadowingSessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!session) return { ok: false, status: 404 };
    ownedSession = session as OwnedSession;
  }

  const audioBuffer = await input.audio.arrayBuffer();

  let result: PronunciationAssessmentResult;
  try {
    result = await assessPronunciation({ audio: audioBuffer, referenceText: input.referenceText });
  } catch (err) {
    if (err instanceof SpeechError) {
      if (err.kind === "throttled") {
        return { ok: false, status: 429, retryAfter: SPEECH_THROTTLE_RETRY_AFTER_MS };
      }
      // `throttled` is handled above; the remaining kinds map to 422/502/503.
      return { ok: false, status: speechErrorStatus(err.kind) as 422 | 502 | 503 };
    }
    throw err;
  }

  if (input.shadowingSessionId) {
    const { error: updateError } = await supabase
      .from("shadowing_sessions")
      .update({
        pronunciation_score: result.pronunciationScore,
        rhythm_score: result.fluencyScore,
      })
      .eq("id", input.shadowingSessionId)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    if (ownedSession) {
      // The Companion's score-based producers hook HERE — this is the moment a
      // pronunciation score first exists. Best-effort:
      // `captureShadowScoreMemories` never throws (§6.5), so a memory hiccup
      // can never fail the learner's scoring request.
      await captureShadowScoreMemories({
        userId: user.id,
        sessionId: ownedSession.id,
        videoId: ownedSession.video_id,
        transcriptLineId: ownedSession.transcript_line_id,
        pronunciationScore: result.pronunciationScore,
      });
    }
  }

  return { ok: true, data: result };
}
