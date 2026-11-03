import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { getTranscript } from "@/lib/data/transcripts";
import { tokenize } from "@/lib/japanese/tokenizer";
import { contentLemmas, DIFFICULTY_BANDS, scoreComprehension } from "@/lib/difficulty";
import { readPreferences } from "@/lib/data/preferences";
import { fetchAllPages, fetchByIdChunks } from "@/lib/data/query-pagination";
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
  const prefs = await readPreferences(supabase, user.id);

  const transcript = transcriptResult.data;
  if (!transcript || transcript.lines.length === 0) {
    return { ok: true, data: scoreComprehension([], new Set(), DIFFICULTY_BANDS[prefs.difficulty]) };
  }

  const lemmas: string[] = [];
  for (const line of transcript.lines) {
    const tokens = await tokenize(line.text_jp);
    lemmas.push(...contentLemmas(tokens));
  }

  const known = await getKnownVocabLemmas(supabase, user.id);
  return { ok: true, data: scoreComprehension(lemmas, known, DIFFICULTY_BANDS[prefs.difficulty]) };
}

/**
 * `getKnownVocabLemmas` asked about `keys` only (lemmas or readings), so one line's cloze does not read the learner's
 * whole mastered vocabulary (ultra review 3): the vocab rows whose word or reading is a key, then the learner's
 * mastered progress on just those. Returns every word and reading of those rows, so `known.has(key)` answers exactly
 * as it would on the full set for any key asked about. RLS confines the progress read to `userId`'s rows.
 */
export async function getKnownVocabAmong(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  keys: readonly string[],
): Promise<Set<string>> {
  const wanted = [...new Set(keys)];
  if (wanted.length === 0) return new Set();
  const byColumn = async (column: "word" | "reading") => {
    const { data, error } = await supabase.from("vocab").select("id, word, reading").in(column, wanted);
    if (error) throw error;
    return (data as { id: string; word: string; reading: string | null }[] | null) ?? [];
  };
  const rows = new Map((await Promise.all([byColumn("word"), byColumn("reading")])).flat().map((row) => [row.id, row]));
  if (rows.size === 0) return new Set();

  const mastered = await fetchByIdChunks([...rows.keys()], async (ids) => {
    const { data, error } = await supabase.from("user_vocab_progress").select("vocab_id")
      .eq("user_id", userId).gte("srs_stage", MASTERY_THRESHOLD).in("vocab_id", ids);
    if (error) throw error;
    return (data as { vocab_id: string }[] | null) ?? [];
  });

  const known = new Set<string>();
  for (const { vocab_id } of mastered) {
    const row = rows.get(vocab_id);
    if (!row) continue;
    known.add(row.word);
    if (row.reading) known.add(row.reading);
  }
  return known;
}

/**
 * The set of vocab lemmas (both the written word and, when available, its
 * reading) the user has mastered — `srs_stage >= MASTERY_THRESHOLD` — used to
 * match against transcript content-word base forms. RLS confines the
 * `user_vocab_progress` read to rows owned by `userId`.
 *
 * Exported so `lib/data/recommendations.ts` (i+1 video recommendations, same
 * "known vocab" definition) can fetch it once per request instead of
 * re-deriving it per video — see that module's doc comment.
 */
export async function getKnownVocabLemmas(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Set<string>> {
  const progress = await fetchAllPages((from, to) => supabase
    .from("user_vocab_progress")
    .select("vocab_id")
    .eq("user_id", userId)
    .gte("srs_stage", MASTERY_THRESHOLD)
    .order("vocab_id", { ascending: true })
    .range(from, to)) as { vocab_id: string }[];
  const vocabIds = progress.map((row) => row.vocab_id);
  if (vocabIds.length === 0) return new Set();

  const vocabRows = await fetchByIdChunks(vocabIds, async (ids) => {
    const { data, error } = await supabase.from("vocab").select("word, reading").in("id", ids);
    if (error) throw error;
    return (data as { word: string; reading: string | null }[] | null) ?? [];
  });

  const known = new Set<string>();
  for (const row of vocabRows) {
    known.add(row.word);
    if (row.reading) known.add(row.reading);
  }
  return known;
}
