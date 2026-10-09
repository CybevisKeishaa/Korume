import { badgeCriteriaSchema } from "./badges";
import type { BadgeSnapshot } from "./types";

export function badgeProgress(criteria: unknown, snapshot: BadgeSnapshot, limits: { kanji: number }): { current: number; target: number; kind: "count" | "streak" } | null {
  const parsed = badgeCriteriaSchema.safeParse(criteria);
  if (!parsed.success) return null;
  const criterion = parsed.data;
  let current: number; let target: number; let kind: "count" | "streak" = "count";
  switch (criterion.type) {
    case "sessions": current = snapshot.totalOutcomes; target = criterion.count; break;
    case "streak": current = snapshot.streakCurrent; target = criterion.days; kind = "streak"; break;
    case "kanji_learned": current = snapshot.kanjiLearned; target = criterion.count; if (target > limits.kanji) return null; break;
    case "xp": current = snapshot.totalXp; target = criterion.total; break;
    case "outcome_count": current = snapshot.outcomeCounts[criterion.source] ?? 0; target = criterion.count; break;
    case "jlpt_mock": return null;
  }
  return current >= target ? null : { current, target, kind };
}
