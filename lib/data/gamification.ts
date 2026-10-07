import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import {
  DAILY_SOURCES,
  evaluateBadges,
  levelForXp,
  sourceIdFor,
  xpForOutcome,
  type BadgeInput,
  type BadgeSnapshot,
  type LearningOutcomeSource,
  type SourceIdParts,
} from "@/lib/gamification";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import { readPreferences } from "@/lib/data/preferences";
import { getStreak } from "@/lib/data/streak";
import { captureCompanionMemories } from "@/lib/data/companion";
import { emitNotification } from "@/lib/notifications/emit";
import { getStudyTimezoneFor } from "@/lib/time/study-timezone";

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
  /** Only meaningful when `source === 'jlpt_submit'` — whether this attempt
   * was a genuine pass. Forwarded to the companion capture gate, which only
   * records `jlpt_passed` when this is `true`. */
  passed?: boolean;
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

  const timeZone = await getStudyTimezoneFor(supabase, input.userId);
  const { data: awardRows, error: awardError } = await supabase.rpc("record_learning_outcome", {
    p_user: input.userId,
    p_source: input.source,
    p_source_id: sourceIdFor(input.source, parts),
    p_xp: xpAmount,
    p_tz: timeZone,
    p_daily: DAILY_SOURCES.includes(input.source),
  });
  if (awardError) throw awardError;
  const award = (awardRows as { xp_awarded: number; prev_xp: number; next_xp: number; had_outcome_today: boolean }[] | null)?.[0];
  if (!award) throw new Error("record_learning_outcome returned no row");
  const isNewXp = award.xp_awarded > 0;
  const xpAwarded = award.xp_awarded;
  const prevXp = award.prev_xp;
  const nextXp = award.next_xp;

  const leveledUp = levelForXp(prevXp).level < levelForXp(nextXp).level;

  // Companion capture gate (spec §4.3) — best-effort, never throws (§6.5).
  await captureCompanionMemories(supabase, {
    userId: input.userId,
    source: input.source,
    parts,
    prevXp,
    nextXp,
    passed: input.passed,
    now,
  });

  if (leveledUp) {
    await emitNotification(supabase, {
      type: "level_up",
      userId: input.userId,
      payload: { level: levelForXp(nextXp).level },
    });
  }

  // Perf: skip the streak read and the badge-snapshot aggregate (5 more queries) when nothing any badge
  // criterion reads could have changed: no XP was awarded and the learner already had an outcome today (so
  // today is already counted in the derived streak). This is the common "re-grinding an already-done-today
  // item" path, which otherwise runs on every single review submission.
  if (!isNewXp && award.had_outcome_today) {
    return { ok: true, xpAwarded: 0, newBadges: [], leveledUp: false };
  }

  const prefs = await readPreferences(supabase, input.userId);
  const streak = await getStreak(supabase, input.userId, timeZone, prefs.scheduleDays, now);
  const snapshot = await buildBadgeSnapshot(supabase, input.userId, nextXp, streak.current);
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
  // because this whole block is already gated by the duplicate-outcome
  // skip above, so it only runs on genuinely new activity; revisit
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
    const { data: testRows, error: testError } = await supabase.from("certification_tests").select("level").in("id", testIds);
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
