import "server-only";
import * as React from "react";
import { buildBadgeSnapshot } from "@/lib/data/badge-snapshot";
import { badgeProgress } from "@/lib/gamification/badge-progress";
import { createClient } from "@/lib/supabase/server";
import { getStreakFact } from "./facts";
import type { DashboardContext } from "./context";

const cache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

interface BadgeRow { id: string; name: string; description: string | null; icon_url: string | null; criteria: unknown }
interface EarnedBadgeRow { badge_id: string; earned_at: string }

export interface AchievementBadge { id: string; name: string; description: string | null; iconUrl: string | null }
export interface AchievementSnapshot {
  earned: (AchievementBadge & { earnedAt: string })[];
  inProgress: (AchievementBadge & { progress: NonNullable<ReturnType<typeof badgeProgress>> })[];
}

export const getAchievementSnapshot = cache(async (context: DashboardContext): Promise<AchievementSnapshot> => {
  const supabase = createClient();
  const [stats, badges, earned, kanji, streak] = await Promise.all([
    supabase.from("user_stats").select("xp").eq("user_id", context.userId).maybeSingle(),
    supabase.from("badges").select("id, name, description, icon_url, criteria"),
    supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", context.userId),
    supabase.from("kanji").select("id", { count: "exact", head: true }),
    getStreakFact(context),
  ]);
  if (stats.error) throw stats.error;
  if (badges.error) throw badges.error;
  if (earned.error) throw earned.error;
  if (kanji.error) throw kanji.error;

  const xp = (stats.data as { xp: number } | null)?.xp ?? 0;
  const snapshot = await buildBadgeSnapshot(supabase, context.userId, xp, streak.current);
  const earnedAt = new Map(((earned.data as EarnedBadgeRow[] | null) ?? []).map((row) => [row.badge_id, row.earned_at]));
  const rows = (badges.data as BadgeRow[] | null) ?? [];
  const toBadge = (row: BadgeRow): AchievementBadge => ({ id: row.id, name: row.name, description: row.description, iconUrl: row.icon_url });
  const earnedBadges = rows.flatMap((row) => {
    const earnedAtValue = earnedAt.get(row.id);
    return earnedAtValue ? [{ ...toBadge(row), earnedAt: earnedAtValue }] : [];
  }).sort((left, right) => right.earnedAt.localeCompare(left.earnedAt)).slice(0, 3);
  const inProgress = rows.flatMap((row) => {
    if (earnedAt.has(row.id)) return [];
    const progress = badgeProgress(row.criteria, snapshot, { kanji: kanji.count ?? 0 });
    return progress ? [{ ...toBadge(row), progress }] : [];
  }).sort((left, right) => right.progress.current / right.progress.target - left.progress.current / left.progress.target)
    .slice(0, Math.max(0, 3 - earnedBadges.length));
  return { earned: earnedBadges, inProgress };
});
