import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { getReviewQueue } from "@/lib/data/srs";
import { levelForXp, type LevelInfo } from "@/lib/gamification";

/**
 * GET /api/user/stats data layer (spec §5 gamification dashboard). Reads
 * `user_stats` + the full badge catalog joined with the caller's earned
 * badges + the SRS due-review count.
 */

/**
 * Cap passed to `getReviewQueue` when counting due items for the dashboard.
 * `getReviewQueue` returns a due-then-fresh queue capped at this limit; the
 * current N5/N4 catalogs (20260712000005_content_n5_n4.sql) are well under
 * this bound, so the count is exact today — revisit (or add a dedicated
 * count query) if the catalog grows past it.
 */
const SRS_DUE_COUNT_LIMIT = 2000;

export interface BadgeSummary {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  /** ISO timestamp the caller earned this badge, or null if not yet earned. */
  earnedAt: string | null;
}

export interface UserStatsData {
  xp: number;
  level: LevelInfo;
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string | null;
  badges: BadgeSummary[];
  srsDueCount: number;
}

export type GetUserStatsResult = { ok: true; data: UserStatsData } | { ok: false; status: 401 };

interface StatsRow {
  xp: number;
  streak_current: number;
  streak_longest: number;
  last_active_date: string | null;
}

interface BadgeRow {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
}

interface EarnedBadgeRow {
  badge_id: string;
  earned_at: string;
}

/**
 * Dashboard summary for the current user: XP/level, streak, the full badge
 * catalog joined with earned state (earned first, then alphabetical), and
 * the SRS due-review count.
 *
 * A user without a `user_stats` row yet (e.g. an account created before the
 * `handle_new_auth_user` trigger existed) reads back as all-zero stats
 * rather than a 500 — the row is created lazily by the gamification award
 * pipeline's first `upsert` (`lib/data/gamification.ts`), not required to
 * pre-exist.
 */
export async function getUserStats(): Promise<GetUserStatsResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data: statsRow, error: statsError } = await supabase
    .from("user_stats")
    .select("xp, streak_current, streak_longest, last_active_date")
    .eq("user_id", user.id)
    .maybeSingle();
  if (statsError) throw statsError;

  const stats = statsRow as StatsRow | null;
  const xp = stats?.xp ?? 0;

  const { data: badgeRows, error: badgeError } = await supabase
    .from("badges")
    .select("id, name, description, icon_url");
  if (badgeError) throw badgeError;

  const { data: earnedRows, error: earnedError } = await supabase
    .from("user_badges")
    .select("badge_id, earned_at")
    .eq("user_id", user.id);
  if (earnedError) throw earnedError;

  const earnedAtByBadgeId = new Map<string, string>();
  for (const row of ((earnedRows as EarnedBadgeRow[] | null) ?? [])) {
    earnedAtByBadgeId.set(row.badge_id, row.earned_at);
  }

  const badges: BadgeSummary[] = ((badgeRows as BadgeRow[] | null) ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      iconUrl: row.icon_url,
      earnedAt: earnedAtByBadgeId.get(row.id) ?? null,
    }))
    .sort((a, b) => {
      if (!!a.earnedAt !== !!b.earnedAt) return a.earnedAt ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const [vocabDue, kanjiDue] = await Promise.all([
    getReviewQueue("vocab", undefined, SRS_DUE_COUNT_LIMIT),
    getReviewQueue("kanji", undefined, SRS_DUE_COUNT_LIMIT),
  ]);

  return {
    ok: true,
    data: {
      xp,
      level: levelForXp(xp),
      streakCurrent: stats?.streak_current ?? 0,
      streakLongest: stats?.streak_longest ?? 0,
      lastActiveDate: stats?.last_active_date ?? null,
      badges,
      srsDueCount: vocabDue.length + kanjiDue.length,
    },
  };
}
