import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import type { VocabMasteryMap } from "@/lib/video-types";

/**
 * word/reading -> srs_stage for vocab the current user has mastered
 * (`srs_stage >= MASTERY_THRESHOLD`), for the adaptive furigana feature
 * (CLAUDE.md §5.4). Reuses the same "known vocab" query shape as
 * `lib/data/difficulty.ts::getKnownVocabLemmas` — look up mastered rows in
 * `user_vocab_progress`, then join `vocab` for word/reading — so both
 * features agree on what counts as "known". RLS confines the progress read
 * to the caller's own rows.
 *
 * Returns an empty map when signed out, so furigana falls back to its safe
 * default (always show) rather than hiding readings for an unknown reader.
 */
export async function getVocabMasteryMap(): Promise<VocabMasteryMap> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return {};

  const { data: progress, error: progressError } = await supabase
    .from("user_vocab_progress")
    .select("vocab_id, srs_stage")
    .eq("user_id", user.id)
    .gte("srs_stage", MASTERY_THRESHOLD);
  if (progressError) throw progressError;

  const rows = (progress ?? []) as { vocab_id: string; srs_stage: number }[];
  if (rows.length === 0) return {};

  const stageByVocabId = new Map(rows.map((row) => [row.vocab_id, row.srs_stage]));

  const { data: vocabRows, error: vocabError } = await supabase
    .from("vocab")
    .select("id, word, reading")
    .in(
      "id",
      rows.map((row) => row.vocab_id),
    );
  if (vocabError) throw vocabError;

  const map: VocabMasteryMap = {};
  for (const row of (vocabRows ?? []) as { id: string; word: string; reading: string | null }[]) {
    const stage = stageByVocabId.get(row.id) ?? MASTERY_THRESHOLD;
    map[row.word] = stage;
    if (row.reading) map[row.reading] = stage;
  }
  return map;
}
