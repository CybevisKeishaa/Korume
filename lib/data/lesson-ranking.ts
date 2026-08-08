import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
    // ledger rows are folded into counts and discarded immediately below),
    // and `rank()`'s return type is `VideoRow[]` — no user id, no membership
    // list ever leaves this function. Deliberate RLS bypass, not an oversight.
    const service = createServiceClient();
    const { data: ledger, error: ledgerError } = await service
      .from("user_lesson_library")
      .select("lesson_id, user_id");
    if (ledgerError) throw ledgerError;

    const learnersByLesson = new Map<string, Set<string>>();
    for (const row of (ledger as { lesson_id: string; user_id: string }[] | null) ?? []) {
      const learners = learnersByLesson.get(row.lesson_id) ?? new Set<string>();
      learners.add(row.user_id);
      learnersByLesson.set(row.lesson_id, learners);
    }
    if (learnersByLesson.size === 0) return [];

    const ranked = [...learnersByLesson.entries()]
      // Distinct learners descending; lesson id ascending breaks ties so the
      // order is deterministic and the unit tests are not flaky.
      .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([lessonId]) => lessonId);

    // Caller-scoped client on purpose here, unlike the ledger read above: RLS
    // on `videos` is the feature, not the obstacle — a PLUS lesson the
    // viewer cannot read must still be filtered by the database, so the
    // returned array may legitimately be shorter than `limit`.
    const supabase = createClient();
    const { data, error } = await supabase.from("videos").select(VIDEO_COLUMNS).in("id", ranked);
    if (error) throw error;

    const byId = new Map((((data as VideoRow[] | null) ?? []).map((v) => [v.id, v])));
    return ranked.flatMap((id) => {
      const lesson = byId.get(id);
      return lesson ? [lesson] : [];
    });
  },
};
