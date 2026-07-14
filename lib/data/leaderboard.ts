import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { mondayStartUtc } from "@/lib/leaderboard/week";
import type { LeaderboardOptInInput } from "@/lib/validation/leaderboard";

/**
 * Weekly XP leaderboard (CLAUDE.md §5 community module; G2,
 * docs/product/business-model.md §1.1: opt-in only, caller's own progress
 * always present — the UI leads with "your progress", not a public ranking).
 *
 * `xp_events` is owner-only RLS (`xp_events_select_own`), so a cross-user
 * aggregate MUST go through the service role — this is the one sanctioned
 * exception the migration comment calls out (20260714000014_community_admin.sql
 * §2), never a permissive cross-user SELECT policy on the table itself.
 */

const OPT_IN_LIMIT = { limit: 10, windowMs: 60_000 };
const TOP_N = 20;

export interface LeaderboardEntry {
  rank: number;
  name: string | null;
  avatarUrl: string | null;
  weeklyXp: number;
  isMe: boolean;
}

export interface LeaderboardPage {
  leaderboard: LeaderboardEntry[];
  /** The caller's own weekly XP total, computed regardless of opt-in status. */
  callerWeeklyXp: number;
  /**
   * The caller's rank among opted-in users, or null when the caller isn't
   * opted in (there is no meaningful rank to show — a rank requires being
   * part of the ranked set). An opted-in caller with zero weekly XP still
   * gets a (low) rank, since they ARE part of the ranked set.
   */
  callerRank: number | null;
}

export type GetLeaderboardResult = { ok: true; data: LeaderboardPage } | { ok: false; status: 401 };

interface XpEventRow {
  user_id: string;
  xp: number;
}

interface OptedInUserRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

/**
 * Top 20 opted-in users by weekly XP (Monday 00:00 VN-local to now), plus the
 * caller's own weekly XP and rank (G2 — always present, even outside the
 * top 20 or not opted in).
 */
export async function getLeaderboard(now: Date = new Date()): Promise<GetLeaderboardResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const weekStartIso = mondayStartUtc(now).toISOString();
  const service = createServiceClient();

  const [xpResult, optedResult] = await Promise.all([
    service.from("xp_events").select("user_id, xp").gte("created_at", weekStartIso),
    service.from("users").select("id, name, avatar_url").eq("leaderboard_opt_in", true),
  ]);
  if (xpResult.error) throw xpResult.error;
  if (optedResult.error) throw optedResult.error;

  const weeklyXpByUser = new Map<string, number>();
  for (const row of (xpResult.data as XpEventRow[]) ?? []) {
    weeklyXpByUser.set(row.user_id, (weeklyXpByUser.get(row.user_id) ?? 0) + row.xp);
  }

  const opted = (optedResult.data as OptedInUserRow[]) ?? [];
  const ranked = opted
    .map((u) => ({ userId: u.id, name: u.name, avatarUrl: u.avatar_url, weeklyXp: weeklyXpByUser.get(u.id) ?? 0 }))
    .sort((a, b) => b.weeklyXp - a.weeklyXp);

  // Deliberately NO userId in the payload: opted-in users consent to showing
  // {name, avatarUrl, weeklyXp}, not their internal id. `isMe` is computed
  // server-side and `rank` is a sufficient list key for the UI.
  const leaderboard: LeaderboardEntry[] = ranked.slice(0, TOP_N).map((entry, index) => ({
    rank: index + 1,
    name: entry.name,
    avatarUrl: entry.avatarUrl,
    weeklyXp: entry.weeklyXp,
    isMe: entry.userId === user.id,
  }));

  const callerIndex = ranked.findIndex((entry) => entry.userId === user.id);
  const callerRank = callerIndex === -1 ? null : callerIndex + 1;
  const callerWeeklyXp = weeklyXpByUser.get(user.id) ?? 0;

  return { ok: true, data: { leaderboard, callerWeeklyXp, callerRank } };
}

export type SetLeaderboardOptInResult =
  | { ok: true; data: { optIn: boolean } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/** Self-serve toggle — `leaderboard_opt_in` is client-writable on the caller's own row (migration 20260714000014_community_admin.sql §1). */
export async function setLeaderboardOptIn(input: LeaderboardOptInInput, now: Date = new Date()): Promise<SetLeaderboardOptInResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`leaderboard:opt-in:${user.id}`, OPT_IN_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { error } = await supabase.from("users").update({ leaderboard_opt_in: input.optIn }).eq("id", user.id);
  if (error) throw error;

  return { ok: true, data: { optIn: input.optIn } };
}
