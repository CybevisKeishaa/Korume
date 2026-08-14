/**
 * JLPT test-engine scoring types (CLAUDE.md spec §5, §5.8 "Câu hỏi đọc hiểu
 * ... chấm tự động"; §5.8 "Thống kê điểm yếu theo dạng câu"). Mirrors the
 * shapes `certification_questions` / `reading_questions` are scored in
 * server-side — see migration 20260712000001_schema.sql and
 * 20260713000011_reading_jlpt.sql. Both predate the rename, so they call
 * `certification_questions` by its original name `jlpt_questions` (renamed by
 * 20260814000027_certification_rename.sql).
 */

/** The four raw JLPT test sections (matches the `jlpt_section` DB enum). */
export type JlptSection = "vocab" | "grammar" | "reading" | "listening";

/** JLPT proficiency levels (matches the `jlpt_level` DB enum), easiest first. */
export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

/** Whether an attempt covers the whole test or a single practice section. */
export type JlptMode = "full" | "section";

/**
 * A `certification_questions` row as scored server-side — includes
 * `correct_answer`, which is never sent to the client (see migration 11's
 * column-scoped grant, written against the pre-rename name `jlpt_questions` —
 * renamed by 20260814000027_certification_rename.sql).
 */
export interface ScoredQuestion {
  id: string;
  section: JlptSection;
  /**
   * e.g. 'kanji-reading' | 'orthography' | 'context' | 'paraphrase' | 'usage'
   * | 'grammar-form' | 'sentence-composition' | 'text-grammar' |
   * 'short-passage' | 'medium-passage' | 'info-retrieval' |
   * 'task-comprehension' | 'point-comprehension' | 'immediate-response'.
   * Kept as `string` (not a union) because content authoring may add new
   * question types without a code change to the scoring engine.
   */
  question_type: string;
  /** Index of the correct choice, as a string: "0".."3". */
  correct_answer: string;
  order_index: number;
}

/**
 * A `reading_questions` row as scored server-side. Same index-string answer
 * convention as `ScoredQuestion`, but reading questions have no `section` /
 * `question_type` — they always belong to a single passage.
 */
export interface ScoredReadingQuestion {
  id: string;
  correct_answer: string;
}

/**
 * Submitted answers keyed by question id, value = chosen choice index as a
 * string ("0".."3"). A missing key means unanswered, scored as wrong.
 */
export type UserAnswers = Record<string, string>;

/** Per-section raw score. */
export interface SectionScore {
  section: JlptSection;
  correct: number;
  total: number;
  /** correct / total * 100, rounded to the nearest integer; 0 when total is 0. */
  percent: number;
}

/**
 * One of the JLPT's official scoring pillars ("configuration-kubun"). N5/N4
 * merge vocab+grammar+reading into a single combined pillar; N3-N1 keep all
 * three as separate pillars. See `PILLAR_STRUCTURE` in `score.ts`.
 */
export type JlptPillar = "language_knowledge" | "reading" | "listening" | "language_knowledge_reading";

/**
 * Approximate scaled score for one pillar, in the spirit of the official
 * 0-60 (or 0-120 for the N5/N4 combined pillar) JLPT scale. This is a linear
 * approximation from raw percent-correct — the real JLPT uses IRT
 * (item-response-theory) equating per test form, which this cannot
 * replicate without the official item-parameter data.
 */
export interface PillarScore {
  pillar: JlptPillar;
  /** Raw sections rolled up into this pillar. */
  sections: JlptSection[];
  correct: number;
  total: number;
  /** 0 when total is 0 (no questions scored for this pillar). */
  percent: number;
  /** round(percent/100 * scaleMax); 0 when total is 0. */
  scaledScore: number;
  /** 60 for a single-section pillar, 120 for the N5/N4 combined pillar. */
  scaleMax: number;
  /** Official published sectional-minimum pass mark on the scaled score. */
  sectionalMinimum: number;
  /** scaledScore >= sectionalMinimum; always false when total is 0. */
  meetsMinimum: boolean;
}

/** `mode: 'full'` result: per-section, per-pillar, and overall pass estimate. */
export interface JlptAttemptResult {
  mode: JlptMode;
  level: JlptLevel;
  sections: SectionScore[];
  totalCorrect: number;
  totalQuestions: number;
  /** 0 when totalQuestions is 0. */
  totalPercent: number;
  /** null when mode is 'section' — pass estimate requires the full test. */
  pillars: PillarScore[] | null;
  /** Sum of pillar scaledScores, out of scaledTotalMax; null when pillars is null. */
  scaledTotal: number | null;
  /** Always 180 when pillars is present (60+120 or 60+60+60). */
  scaledTotalMax: number | null;
  /** Official published total pass mark for `level`; null when pillars is null. */
  passThreshold: number | null;
  /**
   * true/false when a pass estimate could be computed; null when it could
   * not (section mode, or a pillar with zero questions — see
   * `passUnavailableReason`).
   */
  passed: boolean | null;
  /** Human-readable reason `passed` is null; null when `passed` is a boolean. */
  passUnavailableReason: string | null;
}

/** Per-question-type weakness stat, sorted weakest-first by the caller. */
export interface WeaknessStat {
  questionType: string;
  section: JlptSection;
  correct: number;
  total: number;
  /** 0 when total is 0. */
  percent: number;
}

/** `scoreReadingQuiz` result. */
export interface ReadingQuizResult {
  correct: number;
  total: number;
  /** 0 when total is 0. */
  percent: number;
  perQuestion: { id: string; correct: boolean }[];
}
