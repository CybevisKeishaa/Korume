import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, type RequireAdminResult } from "@/lib/admin/guard";

/**
 * Admin stats dashboard (spec §3.11 "Dashboard thống kê user, retention,
 * revenue"). Revenue is deliberately NOT included — there is no billing
 * (PayOS) integration until Layer 8 (CLAUDE.md §3, business-model.md); do not
 * add a `subscriptions` aggregation here before that lands.
 *
 * Every count here is computed by selecting the relevant id/user_id/status
 * column and taking the returned row array's length, rather than a
 * `{count:'exact', head:true}` aggregate — same convention already
 * established for `lib/data/notifications.ts`'s unread-count. This is a
 * pragmatic MVP tradeoff (pulls one narrow column's worth of rows per
 * metric); swap to a head-count query if any of these tables grow large
 * enough for that to matter.
 */

type GuardFailure = Extract<RequireAdminResult, { ok: false }>;

export interface AdminStats {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  retention: {
    cohortSize: number;
    activeCount: number;
    /** Percent, rounded to 1 decimal place; `null` when `cohortSize` is 0. */
    retentionPercent: number | null;
    methodology: string;
  };
  contentCounts: {
    videosPending: number;
    videosApproved: number;
    kanji: number;
    vocab: number;
    grammar: number;
    jlptTests: number;
    readingPassages: number;
  };
  topActivity: { sourceType: string; count: number }[];
  generatedAt: string;
}

export type GetAdminStatsResult = { ok: true; data: AdminStats } | GuardFailure;

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_METHODOLOGY =
  "Users whose account was created 30-60 days ago; percent with at least one xp_event in the last 7 days.";

function isoDaysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

function countRows(data: unknown): number {
  return Array.isArray(data) ? data.length : 0;
}

function distinctUserCount(data: unknown): number {
  const rows = (data as { user_id: string }[] | null) ?? [];
  return new Set(rows.map((r) => r.user_id)).size;
}

/**
 * Assemble the admin stats dashboard. `now` is injectable for deterministic
 * tests; defaults to the real clock.
 */
export async function getAdminStats(now: Date = new Date()): Promise<GetAdminStatsResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();

  const cutoff7 = isoDaysAgo(7, now);
  const cutoff30 = isoDaysAgo(30, now);
  const cutoff60 = isoDaysAgo(60, now);

  const [
    totalUsersRes,
    newUsers7dRes,
    newUsers30dRes,
    active7dRes,
    active30dRes,
    cohortRes,
    videosRes,
    kanjiRes,
    vocabRes,
    grammarRes,
    testsRes,
    passagesRes,
    topActivityRes,
  ] = await Promise.all([
    service.from("users").select("id"),
    service.from("users").select("id").gte("created_at", cutoff7),
    service.from("users").select("id").gte("created_at", cutoff30),
    service.from("xp_events").select("user_id").gte("created_at", cutoff7),
    service.from("xp_events").select("user_id").gte("created_at", cutoff30),
    service.from("users").select("id, created_at").gte("created_at", cutoff60).lt("created_at", cutoff30),
    service.from("videos").select("library_access"),
    service.from("kanji").select("id"),
    service.from("vocab").select("id"),
    service.from("grammar_points").select("id"),
    service.from("certification_tests").select("id"),
    service.from("reading_passages").select("id"),
    service.from("xp_events").select("source_type").gte("created_at", cutoff7),
  ]);

  for (const res of [
    totalUsersRes,
    newUsers7dRes,
    newUsers30dRes,
    active7dRes,
    active30dRes,
    cohortRes,
    videosRes,
    kanjiRes,
    vocabRes,
    grammarRes,
    testsRes,
    passagesRes,
    topActivityRes,
  ]) {
    if (res.error) throw res.error;
  }

  const cohortIds = ((cohortRes.data as { id: string }[] | null) ?? []).map((u) => u.id);
  let retentionActive = 0;
  if (cohortIds.length > 0) {
    const { data: retentionRows, error: retentionError } = await service
      .from("xp_events")
      .select("user_id")
      .in("user_id", cohortIds)
      .gte("created_at", cutoff7);
    if (retentionError) throw retentionError;
    retentionActive = distinctUserCount(retentionRows);
  }

  const videoAccessLevels = (videosRes.data as { library_access: string }[] | null) ?? [];

  const topCounts = new Map<string, number>();
  for (const row of (topActivityRes.data as { source_type: string }[] | null) ?? []) {
    topCounts.set(row.source_type, (topCounts.get(row.source_type) ?? 0) + 1);
  }
  const topActivity = [...topCounts.entries()]
    .map(([sourceType, count]) => ({ sourceType, count }))
    .sort((a, b) => b.count - a.count);

  return {
    ok: true,
    data: {
      totalUsers: countRows(totalUsersRes.data),
      newUsers7d: countRows(newUsers7dRes.data),
      newUsers30d: countRows(newUsers30dRes.data),
      activeUsers7d: distinctUserCount(active7dRes.data),
      activeUsers30d: distinctUserCount(active30dRes.data),
      retention: {
        cohortSize: cohortIds.length,
        activeCount: retentionActive,
        retentionPercent: cohortIds.length > 0 ? Math.round((retentionActive / cohortIds.length) * 1000) / 10 : null,
        methodology: RETENTION_METHODOLOGY,
      },
      contentCounts: {
        videosPending: videoAccessLevels.filter((v) => v.library_access === "PRIVATE").length,
        videosApproved: videoAccessLevels.filter((v) => v.library_access === "FREE" || v.library_access === "PLUS").length,
        kanji: countRows(kanjiRes.data),
        vocab: countRows(vocabRes.data),
        grammar: countRows(grammarRes.data),
        jlptTests: countRows(testsRes.data),
        readingPassages: countRows(passagesRes.data),
      },
      topActivity,
      generatedAt: now.toISOString(),
    },
  };
}
