import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchByIdChunks } from "@/lib/data/query-pagination";
import { VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";

/**
 * How the Hub asks for a ranked set of lessons.
 *
 * The Hub depends on this interface and nothing else: it never sees the
 * formula, never names it, and never renders the underlying number. Ranking is
 * a business decision that will change — later strategies (TrendingStrategy
 * over a time window, RetentionStrategy, AIRecommendedStrategy) drop in behind
 * this same shape without the screen changing (spec D12).
 *
 * The one thing a caller must never do is label a section "Trending" while a
 * library-count strategy is installed. The label belongs to the strategy, not
 * to the layout.
 */
export interface LessonRankingStrategy {
  readonly id: string;
  rank(input: { userId: string; limit: number }): Promise<VideoRow[]>;
}

/**
 * Popular v1: rank by the count of DISTINCT learner libraries containing the
 * lesson. This is a recorded product decision, not an implementation
 * placeholder — it is the only real signal that exists today. There is no view
 * count, no completion rate and no rating in the schema.
 */
export const PopularStrategyV1: LessonRankingStrategy = {
  id: "popular-v1",

  async rank({ limit }): Promise<VideoRow[]> {
    // `user_lesson_library`'s only SELECT policy is owner-only
    // (`user_lesson_library_read`: `user_id = auth.uid()`, see
    // 20260731000018_user_lesson_library.sql). Popularity is an aggregate OVER
    // ALL LEARNERS' libraries, which the caller-scoped (RLS-governed) client
    // cannot see — it would silently return only the calling user's own rows,
    // collapsing "popular" into "lessons in my library" for every real user.
    // This is the same sanctioned exception `lib/data/leaderboard.ts` takes
    // for `xp_events`: nothing per-user crosses the function boundary (the
    // SQL function `popular_lesson_ids` — service_role only — counts distinct
    // learners over every library row and returns lesson ids alone, ties by
    // lesson id ascending), and `rank()`'s return type is `VideoRow[]` — no
    // user id, no membership list ever leaves this function. Deliberate RLS
    // bypass, not an oversight.
    const service = createServiceClient();
    const { data: rankRows, error: rankError } = await service.rpc("popular_lesson_ids", { p_limit: limit });
    if (rankError) throw rankError;
    const ranked = ((rankRows as { lesson_id: string }[] | null) ?? []).map((row) => row.lesson_id);
    if (!ranked.length) return [];

    // Caller-scoped client on purpose here, unlike the ledger read above: RLS
    // on `videos` is the feature, not the obstacle — a PLUS lesson the
    // viewer cannot read must still be filtered by the database, so the
    // returned array may legitimately be shorter than `limit`.
    const supabase = createClient();
    const videos = await fetchByIdChunks(ranked, async (ids) => {
      const { data, error } = await supabase.from("videos").select(VIDEO_COLUMNS).in("id", ids);
      if (error) throw error;
      return (data as VideoRow[] | null) ?? [];
    });
    const byId = new Map(videos.map((v) => [v.id, v]));
    return ranked.flatMap((id) => {
      const lesson = byId.get(id);
      return lesson ? [lesson] : [];
    });
  },
};
