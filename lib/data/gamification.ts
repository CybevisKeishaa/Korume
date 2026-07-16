import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import {
  advanceStreak,
  evaluateBadges,
  levelForXp,
  sourceIdFor,
  xpForOutcome,
  type BadgeInput,
  type BadgeSnapshot,
  type LearningOutcomeSource,
  type SourceIdParts,
  type StreakState,
} from "@/lib/gamification";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import { captureCompanionMemories } from "@/lib/data/companion";
import { emitNotification } from "@/lib/notifications/emit";

/**
 * Award pipeline for completed learning outcomes (CLAUDE.md §5,
 * docs/product/business-model.md §1.1 principles G1-G3). This is the I/O
 * orchestration layer over the pure `lib/gamification` modules — same split
 * as `lib/srs` (pure) / `lib/data/srs.ts` (I/O), `lib/jlpt` / `lib/data/jlpt.ts`,
 * etc., so it lives under `lib/data/` rather than inside `lib/gamification/`.
 *
 * Runs on every review/submit success path (see the wiring in
 * `lib/data/srs.ts`, `lib/data/dictation.ts`, `lib/data/shadowing.ts`,
 * `lib/data/mining.ts`, `lib/data/jlpt.ts`, `lib/data/reading.ts`,
 * `lib/data/conversation.ts`), so `recordActivity` is deliberately
 * best-effort end to end — see its own doc comment.
 */

export interface RecordActivityInput {
  userId: string;
  source: LearningOutcomeSource;
  parts: SourceIdParts;
  /** Only meaningful (and read) when `source === 'jlpt_submit'`; defaults to
   * 'full' if omitted so a caller that forgets it still gets *a* valid XP
   * amount rather than a thrown error. */
  jlptMode?: "section" | "full";
  now?: Date;
}

export interface RecordActivityResult {
  ok: boolean;
  xpAwarded: number;
  newBadges: string[];
  leveledUp: boolean;
}

const FAILURE_RESULT: RecordActivityResult = { ok: false, xpAwarded: 0, newBadges: [], leveledUp: false };

/**
 * Award XP/streak/badges for one completed learning outcome, and emit
 * `level_up`/`badge_earned` notifications when they newly occur.
 *
 * MUST NEVER throw into the caller — this runs on the hot path of every
 * learning-flow success response, and a gamification hiccup (bad row, RLS
 * misconfiguration, transient DB error) must never fail the request that
 * triggered it. Every failure is logged via `console.error` and reported
 * back only as `{ ok: false, ... }` for the caller/tests to inspect.
 */
export async function recordActivity(input: RecordActivityInput): Promise<RecordActivityResult> {
  try {
    return await recordActivityInner(input);
  } catch (err) {
    console.error("[gamification] recordActivity failed:", err);
    return { ...FAILURE_RESULT };
  }
}

async function recordActivityInner(input: RecordActivityInput): Promise<RecordActivityResult> {
  const now = input.now ?? new Date();
  const supabase = createServiceClient();

  const parts: SourceIdParts =
    input.source === "jlpt_submit" && input.jlptMode !== undefined
      ? { ...input.parts, mode: input.jlptMode }
      : input.parts;

  const xpAmount =
    input.source === "jlpt_submit"
      ? xpForOutcome("jlpt_submit", { mode: parts.mode ?? "full" })
      : xpForOutcome(input.source);

  const sourceId = sourceIdFor(input.source, parts, now);

  // 1. Award XP — insert-or-ignore on the natural (user, source, sourceId)
  // key. `data` comes back null only when the row already existed (the
  // unique constraint fired and PostgREST's ON CONFLICT DO NOTHING skipped
  // it) — principle G1: outcomes, not repetition, so re-grinding the same
  // item on the same VN day never re-awards XP.
  const { data: xpEventRow, error: xpEventError } = await supabase
    .from("xp_events")
    .upsert(
      { user_id: input.userId, source_type: input.source, source_id: sourceId, xp: xpAmount },
      { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (xpEventError) throw xpEventError;
  const isNewXp = xpEventRow != null;
  const xpAwarded = isNewXp ? xpAmount : 0;

  // 2. Streak + xp bookkeeping. The user WAS active today regardless of
  // whether this specific outcome had already been awarded today, so the
  // streak always advances; XP only accrues for a genuinely new outcome.
  const { data: statsRow, error: statsError } = await supabase
    .from("user_stats")
    .select("xp, streak_current, streak_longest, last_active_date")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (statsError) throw statsError;

  const stats = statsRow as
    | { xp: number; streak_current: number; streak_longest: number; last_active_date: string | null }
    | null;
  const prevXp = stats?.xp ?? 0;
  const prevStreak: StreakState = {
    current: stats?.streak_current ?? 0,
    longest: stats?.streak_longest ?? 0,
    lastActiveDate: stats?.last_active_date ?? null,
  };
  const nextStreak = advanceStreak(prevStreak, now);
  const nextXp = prevXp + xpAwarded;
  const leveledUp = levelForXp(prevXp).level < levelForXp(nextXp).level;
  const streakChanged =
    nextStreak.current !== prevStreak.current || nextStreak.lastActiveDate !== prevStreak.lastActiveDate;

  const { error: statsUpdateError } = await supabase.from("user_stats").upsert(
    {
      user_id: input.userId,
      xp: nextXp,
      streak_current: nextStreak.current,
      streak_longest: nextStreak.longest,
      last_active_date: nextStreak.lastActiveDate,
    },
    { onConflict: "user_id" },
  );
  if (statsUpdateError) throw statsUpdateError;

  // Companion capture gate (spec §4.3) — best-effort, never throws (§6.5).
  await captureCompanionMemories(supabase, {
    userId: input.userId,
    source: input.source,
    parts,
    prevXp,
    nextXp,
    now,
  });

  if (leveledUp) {
    await emitNotification(supabase, {
      type: "level_up",
      userId: input.userId,
      payload: { level: levelForXp(nextXp).level },
    });
  }

  // Perf: skip the badge-snapshot aggregate (5 more queries) entirely when
  // nothing any badge criterion reads could have changed — a duplicate
  // outcome (no XP) on an already-unchanged streak. This is the common
  // "re-grinding an already-done-today item" path, which otherwise runs on
  // every single review submission.
  if (!isNewXp && !streakChanged) {
    return { ok: true, xpAwarded: 0, newBadges: [], leveledUp: false };
  }

  const snapshot = await buildBadgeSnapshot(supabase, input.userId, nextXp, nextStreak.current);
  const newBadges = await awardNewBadges(supabase, input.userId, snapshot);

  return { ok: true, xpAwarded, newBadges, leveledUp };
}

async function buildBadgeSnapshot(
  supabase: SupabaseClient,
  userId: string,
  totalXp: number,
  streakCurrent: number,
): Promise<BadgeSnapshot> {
  // "Known" kanji reuses the same SRS-mastery threshold the i+1 difficulty
  // engine and adaptive-furigana feature already use for "known vocab"
  // (lib/data/difficulty.ts::MASTERY_THRESHOLD — srs_stage >= 2, i.e. two
  // successful reviews) rather than inventing a second "known" definition.
  const { data: kanjiRows, error: kanjiError } = await supabase
    .from("user_kanji_progress")
    .select("kanji_id")
    .eq("user_id", userId)
    .gte("srs_stage", MASTERY_THRESHOLD);
  if (kanjiError) throw kanjiError;
  const kanjiLearned = ((kanjiRows ?? []) as { kanji_id: string }[]).length;

  // Outcome totals/counts: no GROUP BY available through the query builder
  // without a migration (out of scope for this task), so this fetches every
  // xp_events row for the user and aggregates client-side. Acceptable today
  // because this whole block is already gated by the duplicate+streak-
  // unchanged skip above, so it only runs on genuinely new activity; revisit
  // with a DB-side aggregate (view or RPC) if a single user's xp_events grows
  // large enough for this to matter.
  const { data: outcomeRows, error: outcomeError } = await supabase
    .from("xp_events")
    .select("source_type")
    .eq("user_id", userId);
  if (outcomeError) throw outcomeError;
  const outcomeTypeRows = (outcomeRows ?? []) as { source_type: LearningOutcomeSource }[];
  const outcomeCounts: Partial<Record<LearningOutcomeSource, number>> = {};
  for (const row of outcomeTypeRows) {
    outcomeCounts[row.source_type] = (outcomeCounts[row.source_type] ?? 0) + 1;
  }

  const { data: attemptRows, error: attemptError } = await supabase
    .from("user_test_attempts")
    .select("test_id")
    .eq("user_id", userId)
    .eq("mode", "full");
  if (attemptError) throw attemptError;
  const testIds = Array.from(new Set(((attemptRows ?? []) as { test_id: string }[]).map((row) => row.test_id)));

  let jlptMockLevelsCompleted: string[] = [];
  if (testIds.length > 0) {
    const { data: testRows, error: testError } = await supabase.from("jlpt_tests").select("level").in("id", testIds);
    if (testError) throw testError;
    jlptMockLevelsCompleted = Array.from(new Set(((testRows ?? []) as { level: string }[]).map((row) => row.level)));
  }

  return {
    totalXp,
    streakCurrent,
    kanjiLearned,
    totalOutcomes: outcomeTypeRows.length,
    outcomeCounts,
    jlptMockLevelsCompleted,
  };
}

/** Evaluates badge criteria against `snapshot`, persists newly-earned ones, and
 * emits `badge_earned` for each — returns only the ids that were genuinely new. */
async function awardNewBadges(
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
