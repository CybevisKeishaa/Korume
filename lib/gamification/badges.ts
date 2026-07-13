/**
 * Badge unlock evaluator. `criteria` arrives as `unknown` jsonb straight from
 * the DB, so it is parsed with zod against `BadgeCriteria`; anything
 * unrecognized or malformed is skipped, never thrown — a newer badge type
 * seeded by a later migration must not crash older deployed code. Pure and
 * deterministic: no I/O, no clock.
 */
import { z } from "zod";
import type { BadgeSnapshot, LearningOutcomeSource } from "./types";

const LEARNING_OUTCOME_SOURCES = [
  "srs_review",
  "dictation",
  "shadowing",
  "mining_review",
  "jlpt_submit",
  "reading_submit",
  "conversation",
] as const satisfies readonly LearningOutcomeSource[];

const badgeCriteriaSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sessions"), count: z.number() }),
  z.object({ type: z.literal("streak"), days: z.number() }),
  z.object({ type: z.literal("kanji_learned"), count: z.number() }),
  z.object({ type: z.literal("xp"), total: z.number() }),
  z.object({
    type: z.literal("outcome_count"),
    source: z.enum(LEARNING_OUTCOME_SOURCES),
    count: z.number(),
  }),
  z.object({
    type: z.literal("jlpt_mock"),
    level: z.enum(["N5", "N4", "N3", "N2", "N1"]),
  }),
]);

export interface BadgeInput {
  id: string;
  name: string;
  criteria: unknown;
}

/** Does the snapshot satisfy this (already-parsed) criteria? */
function isSatisfied(
  criteria: z.infer<typeof badgeCriteriaSchema>,
  snapshot: BadgeSnapshot,
): boolean {
  switch (criteria.type) {
    case "sessions":
      return snapshot.totalOutcomes >= criteria.count;
    case "streak":
      return snapshot.streakCurrent >= criteria.days;
    case "kanji_learned":
      return snapshot.kanjiLearned >= criteria.count;
    case "xp":
      return snapshot.totalXp >= criteria.total;
    case "outcome_count":
      return (snapshot.outcomeCounts[criteria.source] ?? 0) >= criteria.count;
    case "jlpt_mock":
      return snapshot.jlptMockLevelsCompleted.includes(criteria.level);
  }
}

/**
 * Return the ids of every badge whose criteria the snapshot satisfies, in
 * input order. Badges with unrecognized or malformed criteria are skipped
 * silently rather than throwing.
 */
export function evaluateBadges(badges: BadgeInput[], snapshot: BadgeSnapshot): string[] {
  const unlocked: string[] = [];

  for (const badge of badges) {
    const parsed = badgeCriteriaSchema.safeParse(badge.criteria);
    if (!parsed.success) {
      continue;
    }
    if (isSatisfied(parsed.data, snapshot)) {
      unlocked.push(badge.id);
    }
  }

  return unlocked;
}
