/**
 * Shared types for the gamification core (CLAUDE.md §5 / docs/product/business-model.md §1.1,
 * principle G1: XP is awarded for completed learning outcomes, not app activity).
 *
 * Pure types only — no runtime logic lives here.
 */

/** A natural learning unit that can earn XP. One value per XP-awarding endpoint. */
export type LearningOutcomeSource =
  | "srs_review"
  | "dictation"
  | "shadowing"
  | "mining_review"
  | "jlpt_submit"
  | "reading_submit"
  | "conversation";

/**
 * Badge unlock conditions, stored as jsonb `criteria` on the `badges` table.
 * This union must match the seeded shapes exactly — the DB migration and this
 * type are a shared contract (see workflow.md Layer 6).
 */
export type BadgeCriteria =
  | { type: "sessions"; count: number }
  | { type: "streak"; days: number }
  | { type: "kanji_learned"; count: number }
  | { type: "xp"; total: number }
  | { type: "outcome_count"; source: LearningOutcomeSource; count: number }
  | { type: "jlpt_mock"; level: "N5" | "N4" | "N3" | "N2" | "N1" };

/**
 * The stats snapshot the badge evaluator reads. Assembled by the caller from
 * whatever aggregate queries are cheapest server-side; this module never
 * queries anything itself.
 */
export interface BadgeSnapshot {
  totalXp: number;
  streakCurrent: number;
  kanjiLearned: number;
  totalOutcomes: number;
  outcomeCounts: Partial<Record<LearningOutcomeSource, number>>;
  jlptMockLevelsCompleted: string[];
}

/** Daily streak state. `lastActiveDate` is a 'yyyy-MM-dd' VN-local (Asia/Ho_Chi_Minh) date string. */
export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}
