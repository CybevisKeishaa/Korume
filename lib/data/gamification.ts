import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  DAILY_SOURCES,
  sourceIdFor,
  xpForOutcome,
  type LearningOutcomeSource,
  type SourceIdParts,
} from "@/lib/gamification";
import { captureCompanionMemories } from "@/lib/data/companion";
import { afterXpAward } from "@/lib/data/xp-award";
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
 * Record an outcome, award XP and badges, and emit
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

  // Perf: skip the streak read and the badge-snapshot aggregate (5 more queries) when nothing any badge
  // criterion reads could have changed: no XP was awarded and the learner already had an outcome today (so
  // today is already counted in the derived streak). This is the common "re-grinding an already-done-today
  // item" path, which otherwise runs on every single review submission.
  if (!isNewXp && award.had_outcome_today) {
    return { ok: true, xpAwarded: 0, newBadges: [], leveledUp: false };
  }

  // No XP means no level-up, so the early return above never skips one.
  const { newBadges, leveledUp } = await afterXpAward(supabase, { userId: input.userId, prevXp, nextXp, now, timeZone });
  return { ok: true, xpAwarded, newBadges, leveledUp };
}
