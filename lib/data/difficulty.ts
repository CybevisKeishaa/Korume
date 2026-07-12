import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { getTranscript } from "@/lib/data/transcripts";
import { tokenize } from "@/lib/japanese/tokenizer";
import { contentLemmas, scoreComprehension } from "@/lib/difficulty";
import type { ComprehensionScore } from "@/lib/difficulty";

/**
 * Minimum SM-2 `srs_stage` (repetitions) for a vocab item to count as
 * "known" for i+1 scoring — two successful reviews, i.e. past the initial
 * 1-day/6-day passes, not just seen once.
 */
export const MASTERY_THRESHOLD = 2;

export type VideoDifficultyResult =
  | { ok: true; data: ComprehensionScore }
  | { ok: false; status: 401 | 404 };

/**
 * Score a video's comprehensibility for the current user (i+1 engine,
 * CLAUDE.md §5.2): tokenize the video's newest transcript, reduce to content
 * lemmas, and compare against the words the user has mastered via SRS.
 *
 * Never touches video bytes — only the stored transcript text (CLAUDE.md §2).
 */
export async function getVideoDifficulty(videoId: string): Promise<VideoDifficultyResult> {
  const transcriptResult = await getTranscript(videoId);
  if (!transcriptResult.ok) return transcriptResult;

  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const transcript = transcriptResult.data;
  if (!transcript || transcript.lines.length === 0) {
    return { ok: true, data: scoreComprehension([], new Set()) };
  }

  const lemmas: string[] = [];
  for (const line of transcript.lines) {
    const tokens = await tokenize(line.text_jp);
    lemmas.push(...contentLemmas(tokens));
  }

  const known = await getKnownVocabLemmas(supabase, user.id);
  return { ok: true, data: scoreComprehension(lemmas, known) };
}

/**
 * The set of vocab lemmas (both the written word and, when available, its
 * reading) the user has mastered — `srs_stage >= MASTERY_THRESHOLD` — used to
 * match against transcript content-word base forms. RLS confines the
 * `user_vocab_progress` read to rows owned by `userId`.
 */
async function getKnownVocabLemmas(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Set<string>> {
  const { data: progress, error: progressError } = await supabase
    .from("user_vocab_progress")
    .select("vocab_id")
    .eq("user_id", userId)
    .gte("srs_stage", MASTERY_THRESHOLD);
  if (progressError) throw progressError;

  const vocabIds = ((progress ?? []) as { vocab_id: string }[]).map((row) => row.vocab_id);
  if (vocabIds.length === 0) return new Set();

  const { data: vocabRows, error: vocabError } = await supabase
    .from("vocab")
    .select("word, reading")
    .in("id", vocabIds);
  if (vocabError) throw vocabError;

  const known = new Set<string>();
  for (const row of (vocabRows ?? []) as { word: string; reading: string | null }[]) {
    known.add(row.word);
    if (row.reading) known.add(row.reading);
  }
  return known;
}
