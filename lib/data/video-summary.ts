import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser, selectVideoById } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { AiError, isAiEnabled, summarizeTranscript, type KeyGrammar, type KeyVocab } from "@/lib/ai";
import { aiErrorStatus } from "@/lib/http-status";

const SUMMARY_LIMIT = { limit: 5, windowMs: 60_000 };
const SUMMARY_COLUMNS = "id, video_id, summary, key_vocab, key_grammar, model, created_at";

export interface VideoSummaryRow {
  id: string;
  video_id: string;
  summary: string;
  key_vocab: KeyVocab[];
  key_grammar: KeyGrammar[];
  model: string;
  created_at: string;
}

export type GetVideoSummaryResult = { ok: true; data: VideoSummaryRow } | { ok: false; status: 401 | 404 };

/** Cached video summary lookup (RLS: SELECT is open to any authenticated user). */
export async function getVideoSummary(videoId: string): Promise<GetVideoSummaryResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const video = await selectVideoById(supabase, videoId);
  if (!video) return { ok: false, status: 404 };

  const { data, error } = await supabase
    .from("video_summaries")
    .select(SUMMARY_COLUMNS)
    .eq("video_id", videoId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: data as VideoSummaryRow };
}

export type GenerateVideoSummaryResult =
  | { ok: true; data: VideoSummaryRow; cached: boolean; inputTruncated?: boolean }
  | { ok: false; status: 401 | 404 | 422 }
  // Our own limiter (retryAfter set) OR a mapped AiError status (503/500/502/429
  // from Anthropic's own quota — retryAfter unset there). Merged into one
  // generic variant so `status === 429` narrows unambiguously in the route.
  | { ok: false; status: number; retryAfter?: number };

/**
 * Generate-once: returns the existing summary if one was already generated
 * (`cached: true`), otherwise summarises the video's most recent transcript
 * via Claude and inserts the row through the service-role client (RLS grants
 * no `authenticated` write on `video_summaries` — see migration 10).
 */
export async function generateVideoSummary(videoId: string): Promise<GenerateVideoSummaryResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`videos:summary:${user.id}`, SUMMARY_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const video = await selectVideoById(supabase, videoId);
  if (!video) return { ok: false, status: 404 };

  const { data: existing, error: existingError } = await supabase
    .from("video_summaries")
    .select(SUMMARY_COLUMNS)
    .eq("video_id", videoId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { ok: true, data: existing as VideoSummaryRow, cached: true };

  if (!isAiEnabled()) return { ok: false, status: 503 };

  const { data: transcript, error: transcriptError } = await supabase
    .from("transcripts")
    .select("id")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (transcriptError) throw transcriptError;
  if (!transcript) return { ok: false, status: 422 };

  const { data: lineRows, error: linesError } = await supabase
    .from("transcript_lines")
    .select("text_jp")
    .eq("transcript_id", (transcript as { id: string }).id)
    .order("start_time", { ascending: true });
  if (linesError) throw linesError;

  const lines = ((lineRows as { text_jp: string }[]) ?? []).map((row) => row.text_jp);
  if (lines.length === 0) return { ok: false, status: 422 };

  let summaryResult;
  try {
    summaryResult = await summarizeTranscript({ title: video.title, lines });
  } catch (err) {
    if (err instanceof AiError) return { ok: false, status: aiErrorStatus(err.kind) };
    throw err;
  }

  const service = createServiceClient();
  const { data: inserted, error: insertError } = await service
    .from("video_summaries")
    .insert({
      video_id: videoId,
      summary: summaryResult.summary,
      key_vocab: summaryResult.keyVocab,
      key_grammar: summaryResult.keyGrammar,
      model: summaryResult.model,
    })
    .select(SUMMARY_COLUMNS)
    .single();

  if (insertError) {
    // Unique-violation race: a concurrent request generated it first.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("video_summaries")
        .select(SUMMARY_COLUMNS)
        .eq("video_id", videoId)
        .maybeSingle();
      if (raced) return { ok: true, data: raced as VideoSummaryRow, cached: true };
    }
    throw insertError;
  }

  return {
    ok: true,
    data: inserted as VideoSummaryRow,
    cached: false,
    inputTruncated: summaryResult.inputTruncated,
  };
}
