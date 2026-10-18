import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { inspectWav, WAV_MAX_BYTES } from "@/lib/audio/wav-header";
import { toAssessment, type Assessment } from "@/lib/pronunciation/assessment";
import { assessPronunciation, isSpeechConfigured, SpeechError, SpeechThrottledError, type PronunciationAssessmentResult } from "@/lib/speech-scoring";
import { speechErrorStatus } from "@/lib/http-status";
import { validateAudioSize } from "@/lib/validation/audio";
import { captureShadowScoreMemories } from "@/lib/data/companion";

/** Both scoring flows share the same per-user quota. */
const SCORE_LIMIT = { limit: 10, windowMs: 60_000 };
type ScoringFailure =
  | { ok: false; status: 401 | 422 | 502 | 503 }
  | { ok: false; status: 429; retryAfter: number | null };
export type ScoreSessionResult =
  | { ok: true; data: { sessionId: string; lineId: string; pronunciationScore: number; rhythmScore: number; assessment: Assessment } }
  | ScoringFailure
  | { ok: false; status: 409; reason: "not_claimable" | "legacy_format" | "superseded" };
interface ClaimRow {
  claim: string;
  video_id: string | null;
  transcript_line_id: string | null;
  recording_url: string | null;
}
function speechFailure(error: SpeechError): ScoringFailure {
  if (error.kind === "throttled") {
    return { ok: false, status: 429, retryAfter: error instanceof SpeechThrottledError ? error.retryAfterMs ?? null : null };
  }
  return { ok: false, status: speechErrorStatus(error.kind) as 422 | 502 | 503 };
}

/** Score only a caller-owned stored take; the current service-issued claim alone can finish it. */
export async function scoreSession(sessionId: string): Promise<ScoreSessionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const limited = rateLimit(`pronunciation:score:${user.id}`, SCORE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };
  if (!isSpeechConfigured()) return { ok: false, status: 503 };

  // The service-only RPC checks caller ownership and issues the unforgeable lease token.
  const service = createServiceClient();
  const { data: claimed, error: claimError } = await service.rpc("claim_pronunciation_scoring", { p_user: user.id, p_session: sessionId });
  if (claimError) throw claimError;
  const lease = (claimed as ClaimRow[] | null)?.[0];
  if (!lease) return { ok: false, status: 409, reason: "not_claimable" };
  const release = async () => {
    const { error } = await service.rpc("release_pronunciation_scoring", { p_session: sessionId, p_claim: lease.claim });
    if (error) throw error;
  };

  try {
    if (!lease.recording_url || lease.recording_url.endsWith(".webm")) {
      await release(); return { ok: false, status: 409, reason: "legacy_format" };
    }
    if (!lease.transcript_line_id || !lease.video_id) { await release(); return { ok: false, status: 422 }; }
    const { data: line, error: lineError } = await supabase.from("transcript_lines")
      .select("text_jp, transcripts!inner(video_id)")
      .eq("id", lease.transcript_line_id).eq("transcripts.video_id", lease.video_id).maybeSingle();
    if (lineError) throw lineError;
    if (!line?.text_jp) { await release(); return { ok: false, status: 422 }; }
    const { data: file, error: downloadError } = await supabase.storage.from("recordings").download(lease.recording_url);
    if (downloadError || !file || file.size > WAV_MAX_BYTES) {
      await release(); return { ok: false, status: 422 };
    }
    // Storage remains writable by the user after save; validate the downloaded bytes again.
    const audio = await file.arrayBuffer();
    if (!inspectWav(new Uint8Array(audio)).ok) { await release(); return { ok: false, status: 422 }; }
    const result = await assessPronunciation({ audio, referenceText: line.text_jp });
    const assessment = toAssessment(result);
    const { data: finished, error: finishError } = await service.rpc("finish_pronunciation_scoring", {
      p_session: sessionId, p_claim: lease.claim, p_pronunciation: result.pronunciationScore,
      p_rhythm: result.fluencyScore, p_assessment: assessment,
    });
    if (finishError) throw finishError;
    if (finished !== true) return { ok: false, status: 409, reason: "superseded" };
    await captureShadowScoreMemories({
      userId: user.id, sessionId, videoId: lease.video_id, transcriptLineId: lease.transcript_line_id,
      pronunciationScore: result.pronunciationScore,
    });
    return { ok: true, data: { sessionId, lineId: lease.transcript_line_id, pronunciationScore: result.pronunciationScore, rhythmScore: result.fluencyScore, assessment } };
  } catch (error) {
    await release();
    if (error instanceof SpeechError) return speechFailure(error);
    throw error;
  }
}

export type ScoreConversationPronunciationResult = { ok: true; data: PronunciationAssessmentResult } | ScoringFailure;
/** Ephemeral conversation scoring has no session id, persistence or Companion side effects. */
export async function scoreConversationPronunciation(input: { audio: Blob; referenceText: string }): Promise<ScoreConversationPronunciationResult> {
  const user = await requireUser(createClient());
  if (!user) return { ok: false, status: 401 };
  const limited = rateLimit(`pronunciation:score:${user.id}`, SCORE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };
  if (!isSpeechConfigured()) return { ok: false, status: 503 };
  if (!validateAudioSize({ size: input.audio.size }).ok) return { ok: false, status: 422 };
  try {
    const data = await assessPronunciation({ audio: await input.audio.arrayBuffer(), referenceText: input.referenceText });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof SpeechError) return speechFailure(error);
    throw error;
  }
}
