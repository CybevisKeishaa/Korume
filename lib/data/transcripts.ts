import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseTranscript } from "@/lib/transcript";
import { toFurigana } from "@/lib/japanese";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser, selectVideoById } from "@/lib/data/videos";
import type { TranscriptIngestInput } from "@/lib/validation/video";

export interface TranscriptLineRow {
  id: string;
  start_time: number;
  end_time: number | null;
  text_jp: string;
  text_translation: string | null;
  furigana_json: unknown;
}

export interface TranscriptWithLines {
  id: string;
  video_id: string;
  source: "youtube_caption" | "user_submitted" | "ai_generated";
  language: string;
  created_at: string;
  lines: TranscriptLineRow[];
}

const MAX_TRANSCRIPT_LINES = 2000;
const TRANSCRIPT_LIMIT = { limit: 5, windowMs: 60_000 };

export type SaveTranscriptResult =
  | { ok: true; data: { transcriptId: string; lineCount: number } }
  | { ok: false; status: 401 | 404 | 422 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Ingest a user-submitted transcript: parse + sanitize the raw text, attach
 * furigana to every line, and persist the transcript + its lines.
 */
export async function saveTranscript(
  videoId: string,
  input: TranscriptIngestInput,
): Promise<SaveTranscriptResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`videos:transcript:${user.id}`, TRANSCRIPT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const video = await selectVideoById(supabase, videoId);
  if (!video) return { ok: false, status: 404 };

  const parsedLines = parseTranscript(input.raw, input.format);
  if (parsedLines.length === 0 || parsedLines.length > MAX_TRANSCRIPT_LINES) {
    return { ok: false, status: 422 };
  }

  const linesWithFurigana = [];
  for (const line of parsedLines) {
    const furigana = await toFurigana(line.textJp);
    linesWithFurigana.push({
      start_time: line.startTime,
      end_time: line.endTime,
      text_jp: line.textJp,
      text_translation: line.textTranslation ?? null,
      furigana_json: furigana,
    });
  }

  const { data: transcript, error: transcriptError } = await supabase
    .from("transcripts")
    .insert({ video_id: videoId, source: "user_submitted", language: "ja" })
    .select("id")
    .single();
  if (transcriptError) return { ok: false, status: 422 };

  const transcriptId = (transcript as { id: string }).id;

  const { error: linesError } = await supabase
    .from("transcript_lines")
    .insert(linesWithFurigana.map((line) => ({ ...line, transcript_id: transcriptId })));

  if (linesError) {
    // Best-effort cleanup so a failed ingest doesn't leave an empty transcript behind.
    await supabase.from("transcripts").delete().eq("id", transcriptId);
    return { ok: false, status: 422 };
  }

  return { ok: true, data: { transcriptId, lineCount: linesWithFurigana.length } };
}

export type GetTranscriptResult =
  | { ok: true; data: TranscriptWithLines | null }
  | { ok: false; status: 401 | 404 };

/** The most recently added transcript for a video, with its lines in playback order. */
export async function getTranscript(videoId: string): Promise<GetTranscriptResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const video = await selectVideoById(supabase, videoId);
  if (!video) return { ok: false, status: 404 };

  const { data: transcript, error: transcriptError } = await supabase
    .from("transcripts")
    .select("id, video_id, source, language, created_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (transcriptError) throw transcriptError;
  if (!transcript) return { ok: true, data: null };

  const { data: lines, error: linesError } = await supabase
    .from("transcript_lines")
    .select("id, start_time, end_time, text_jp, text_translation, furigana_json")
    .eq("transcript_id", (transcript as { id: string }).id)
    .order("start_time", { ascending: true });
  if (linesError) throw linesError;

  return {
    ok: true,
    data: { ...(transcript as Omit<TranscriptWithLines, "lines">), lines: (lines as TranscriptLineRow[]) ?? [] },
  };
}
