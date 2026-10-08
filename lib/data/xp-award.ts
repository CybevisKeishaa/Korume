import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateBadges, levelForXp, type BadgeInput, type BadgeSnapshot } from "@/lib/gamification";
import { buildBadgeSnapshot } from "@/lib/data/badge-snapshot";
import { readPreferences } from "@/lib/data/preferences";
import { getStreak } from "@/lib/data/streak";
import { emitNotification } from "@/lib/notifications/emit";
import { getStudyTimezoneFor } from "@/lib/time/study-timezone";

/** What follows any committed XP award — a learning outcome (recordActivity) or the daily mission reward
 * (claimActiveMission): the level-up notification, then the streak read, badge snapshot and new badges. */
export async function afterXpAward(
  supabase: SupabaseClient,
  input: { userId: string; prevXp: number; nextXp: number; now: Date; timeZone?: string },
): Promise<{ newBadges: string[]; leveledUp: boolean }> {
  const leveledUp = levelForXp(input.prevXp).level < levelForXp(input.nextXp).level;
  if (leveledUp) {
    await emitNotification(supabase, {
      type: "level_up",
      userId: input.userId,
      payload: { level: levelForXp(input.nextXp).level },
    });
  }
  const timeZone = input.timeZone ?? await getStudyTimezoneFor(supabase, input.userId);
  const prefs = await readPreferences(supabase, input.userId);
  const streak = await getStreak(supabase, input.userId, timeZone, prefs.scheduleDays, input.now);
  const snapshot = await buildBadgeSnapshot(supabase, input.userId, input.nextXp, streak.current);
  const newBadges = await awardNewBadges(supabase, input.userId, snapshot);
  return { newBadges, leveledUp };
}

/** Evaluates badge criteria against `snapshot`, persists newly-earned ones, and
 * emits `badge_earned` for each — returns only the ids that were genuinely new. */
export async function awardNewBadges(
  supabase: SupabaseClient,
  userId: string,
  snapshot: BadgeSnapshot,
): Promise<string[]> {
  const { data: earnedRows, error: earnedError } = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
  if (earnedError) throw earnedError;
  const earnedIds = new Set(((earnedRows ?? []) as { badge_id: string }[]).map((row) => row.badge_id));

  const { data: badgeRows, error: badgeError } = await supabase.from("badges").select("id, name, criteria");
  if (badgeError) throw badgeError;
  const allBadges = (badgeRows ?? []) as BadgeInput[];
  const unearned = allBadges.filter((badge) => !earnedIds.has(badge.id));

  const unlockedIds = evaluateBadges(unearned, snapshot);
  if (unlockedIds.length === 0) return [];

  // Insert-or-ignore, same idempotency pattern as xp_events: a race against
  // another request evaluating the same badge only ever inserts once, and
  // `.select()` returns only the rows that were actually inserted, which is
  // exactly the set that's "genuinely new" and worth a notification.
  const { data: insertedRows, error: insertError } = await supabase
    .from("user_badges")
    .upsert(
      unlockedIds.map((badgeId) => ({ user_id: userId, badge_id: badgeId })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true },
    )
    .select("badge_id");
  if (insertError) throw insertError;

  const genuinelyNewIds = ((insertedRows ?? []) as { badge_id: string }[]).map((row) => row.badge_id);
  const nameById = new Map(allBadges.map((badge) => [badge.id, badge.name]));

  for (const badgeId of genuinelyNewIds) {
    await emitNotification(supabase, {
      type: "badge_earned",
      userId,
      payload: { badgeId, badgeName: nameById.get(badgeId) ?? badgeId },
    });
  }

  return genuinelyNewIds;
}
