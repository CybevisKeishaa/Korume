import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { fetchByIdChunks } from "@/lib/data/query-pagination";

/**
 * This learner's SRS stage per curated vocab id, read under their own RLS on every request.
 * It is joined onto the shared static analysis and never cached with it (spec §5.1).
 */
export async function readMastery(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  vocabIds: readonly string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(vocabIds)];
  const rows = await fetchByIdChunks(unique, async (ids) => {
    const { data, error } = await supabase
      .from("user_vocab_progress")
      .select("vocab_id, srs_stage")
      .eq("user_id", userId)
      .in("vocab_id", ids);
    if (error) throw error;
    return (data ?? []) as { vocab_id: string; srs_stage: number }[];
  });
  return Object.fromEntries(rows.map((row) => [row.vocab_id, row.srs_stage]));
}
