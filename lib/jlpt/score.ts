/**
 * JLPT test-engine scoring (spec §5, §5.8 "chấm tự động" / "Thống kê điểm
 * yếu theo dạng câu"; CLAUDE.md §7 — deterministic, pure, unit-tested).
 *
 * No I/O, no randomness, no `Date.now()`. Every function is a plain
 * reduction over `questions` + `answers`, so results are reproducible and
 * safe to call from an API route with data already fetched server-side.
 *
 * ## Approximate scaled scoring (IMPORTANT — read before trusting `passed`)
 *
 * The real JLPT reports 0-60 (or a 0-120 combined range for N5/N4) per
 * scoring pillar via Item Response Theory (IRT) equating, which weighs each
 * question by its calibrated difficulty and compares against a norm
 * population. We have none of that — only which questions were answered
 * correctly. `scaledScore` here is a **linear approximation**:
 * `round(percentCorrect * scaleMax)`. Treat `passed` as a rough estimate for
 * study planning, never as an official result.
 *
 * Pillar structure and thresholds (published JLPT pass marks):
 *  - N5 / N4: two pillars — combined "language knowledge + reading"
 *    (vocab + grammar + reading, 0-120, sectional minimum 38) and
 *    "listening" (0-60, sectional minimum 19). Total pass marks: N5 80/180,
 *    N4 90/180.
 *  - N3 / N2 / N1: three independent pillars — "language knowledge"
 *    (vocab + grammar, 0-60), "reading" (0-60), "listening" (0-60), each
 *    with sectional minimum 19. Total pass marks: N3 95, N2 90, N1 100.
 *
 * A candidate passes only if the total scaled score clears the level's
 * threshold AND every pillar individually clears its sectional minimum —
 * failing any one pillar fails the whole test even with a high total
 * (mirrors the real JLPT rule).
 */
import type {
  JlptAttemptResult,
  JlptLevel,
  JlptMode,
  JlptPillar,
  JlptSection,
  PillarScore,
  ReadingQuizResult,
  ScoredQuestion,
  ScoredReadingQuestion,
  SectionScore,
  UserAnswers,
  WeaknessStat,
} from "./types";

/** Canonical section display/grouping order — used wherever sections are listed. */
export const SECTION_ORDER: JlptSection[] = ["vocab", "grammar", "reading", "listening"];

/** Total scaled-score ceiling across all pillars (60+120 or 60+60+60), matches the official 0-180 scale. */
export const SCALED_TOTAL_MAX = 180;

interface PillarDef {
  pillar: JlptPillar;
  sections: JlptSection[];
  scaleMax: number;
  sectionalMinimum: number;
}

const COMBINED_N5_N4: PillarDef[] = [
  { pillar: "language_knowledge_reading", sections: ["vocab", "grammar", "reading"], scaleMax: 120, sectionalMinimum: 38 },
  { pillar: "listening", sections: ["listening"], scaleMax: 60, sectionalMinimum: 19 },
];

const THREE_PILLAR: PillarDef[] = [
  { pillar: "language_knowledge", sections: ["vocab", "grammar"], scaleMax: 60, sectionalMinimum: 19 },
  { pillar: "reading", sections: ["reading"], scaleMax: 60, sectionalMinimum: 19 },
  { pillar: "listening", sections: ["listening"], scaleMax: 60, sectionalMinimum: 19 },
];

/**
 * Per-level pillar structure. N5/N4 share the combined-pillar shape; N3-N1
 * share the three-independent-pillar shape (spec above).
 */
export const PILLAR_STRUCTURE: Record<JlptLevel, PillarDef[]> = {
  N5: COMBINED_N5_N4,
  N4: COMBINED_N5_N4,
  N3: THREE_PILLAR,
  N2: THREE_PILLAR,
  N1: THREE_PILLAR,
};

/**
 * Published total pass marks (out of 180), matching the official JLPT
 * scoring criteria: N5 80, N4 90, N3 95, N2 90, N1 100. These affect the
 * `passed` estimate shown to learners — change only with product sign-off.
 */
export const PASS_THRESHOLD: Record<JlptLevel, number> = {
  N5: 80,
  N4: 90,
  N3: 95,
  N2: 90,
  N1: 100,
};

/** correct/total * 100 rounded to the nearest integer; 0 when total is 0 (guards div/0). */
function percentOf(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

/** A question is correct only if the user answered it AND the answer matches exactly. Missing key = wrong. */
function isAnsweredCorrectly(question: { id: string; correct_answer: string }, answers: UserAnswers): boolean {
  return answers[question.id] === question.correct_answer;
}

function countCorrect<T extends { id: string; correct_answer: string }>(questions: T[], answers: UserAnswers): number {
  return questions.reduce((n, q) => n + (isAnsweredCorrectly(q, answers) ? 1 : 0), 0);
}

/**
 * Per-section raw score, sections listed in `SECTION_ORDER` and limited to
 * sections actually present in `questions` (a section with zero questions
 * in the input is simply absent, not a zero-row entry).
 */
export function scoreSections(questions: ScoredQuestion[], answers: UserAnswers): SectionScore[] {
  const bySection = new Map<JlptSection, ScoredQuestion[]>();
  for (const q of questions) {
    const bucket = bySection.get(q.section);
    if (bucket) {
      bucket.push(q);
    } else {
      bySection.set(q.section, [q]);
    }
  }

  const result: SectionScore[] = [];
  for (const section of SECTION_ORDER) {
    const bucket = bySection.get(section);
    if (!bucket) continue;
    const correct = countCorrect(bucket, answers);
    result.push({ section, correct, total: bucket.length, percent: percentOf(correct, bucket.length) });
  }
  return result;
}

/** Roll `questions` up into the pillar structure for `level`. */
function scorePillars(questions: ScoredQuestion[], answers: UserAnswers, level: JlptLevel): PillarScore[] {
  return PILLAR_STRUCTURE[level].map((def) => {
    const sectionSet = new Set(def.sections);
    const relevant = questions.filter((q) => sectionSet.has(q.section));
    const total = relevant.length;
    const correct = countCorrect(relevant, answers);
    const percent = percentOf(correct, total);
    const scaledScore = total === 0 ? 0 : Math.round((correct / total) * def.scaleMax);
    const meetsMinimum = total > 0 && scaledScore >= def.sectionalMinimum;
    return {
      pillar: def.pillar,
      sections: def.sections,
      correct,
      total,
      percent,
      scaledScore,
      scaleMax: def.scaleMax,
      sectionalMinimum: def.sectionalMinimum,
      meetsMinimum,
    };
  });
}

/**
 * Score a JLPT test attempt.
 *
 * - `mode: 'section'` scores only the sections present in `questions` and
 *   never attempts a pass/fail estimate (the official pass rule needs the
 *   whole test's pillars) — `pillars`/`scaledTotal`/`passed` are all `null`.
 * - `mode: 'full'` additionally computes the pillar breakdown and a pass
 *   estimate for `level`. If the attempt is empty, or any pillar the level
 *   requires has zero questions, `passed` is `null` (not `false`) with
 *   `passUnavailableReason` explaining why — an estimate would be
 *   meaningless, not "failing", with missing data.
 */
export function scoreJlptAttempt(
  questions: ScoredQuestion[],
  answers: UserAnswers,
  mode: JlptMode,
  level: JlptLevel,
): JlptAttemptResult {
  const sections = scoreSections(questions, answers);
  const totalQuestions = questions.length;
  const totalCorrect = countCorrect(questions, answers);
  const totalPercent = percentOf(totalCorrect, totalQuestions);

  const base = { mode, level, sections, totalCorrect, totalQuestions, totalPercent };

  if (mode === "section") {
    return {
      ...base,
      pillars: null,
      scaledTotal: null,
      scaledTotalMax: null,
      passThreshold: null,
      passed: null,
      passUnavailableReason: "Pass/fail estimate requires mode 'full' (all sections scored together).",
    };
  }

  const pillars = scorePillars(questions, answers, level);

  if (totalQuestions === 0) {
    return {
      ...base,
      pillars,
      scaledTotal: null,
      scaledTotalMax: null,
      passThreshold: null,
      passed: null,
      passUnavailableReason: "No questions in this attempt.",
    };
  }

  const emptyPillars = pillars.filter((p) => p.total === 0);
  if (emptyPillars.length > 0) {
    const names = emptyPillars.map((p) => p.pillar).join(", ");
    return {
      ...base,
      pillars,
      scaledTotal: null,
      scaledTotalMax: null,
      passThreshold: null,
      passed: null,
      passUnavailableReason: `Pass estimate unavailable: no questions scored for pillar(s): ${names}.`,
    };
  }

  const scaledTotal = pillars.reduce((n, p) => n + p.scaledScore, 0);
  const passThreshold = PASS_THRESHOLD[level];
  const passed = scaledTotal >= passThreshold && pillars.every((p) => p.meetsMinimum);

  return {
    ...base,
    pillars,
    scaledTotal,
    scaledTotalMax: SCALED_TOTAL_MAX,
    passThreshold,
    passed,
    passUnavailableReason: null,
  };
}

/**
 * Per-`question_type` weakness breakdown, sorted weakest-first (lowest
 * percent first) so it can drive "gợi ý bài ôn tập" directly. Ties break
 * alphabetically by `questionType` for a fully deterministic order.
 */
export function weaknessStats(questions: ScoredQuestion[], answers: UserAnswers): WeaknessStat[] {
  const byType = new Map<string, { section: JlptSection; items: ScoredQuestion[] }>();
  for (const q of questions) {
    const bucket = byType.get(q.question_type);
    if (bucket) {
      bucket.items.push(q);
    } else {
      byType.set(q.question_type, { section: q.section, items: [q] });
    }
  }

  const stats: WeaknessStat[] = Array.from(byType.entries()).map(([questionType, { section, items }]) => {
    const correct = countCorrect(items, answers);
    return { questionType, section, correct, total: items.length, percent: percentOf(correct, items.length) };
  });

  stats.sort((a, b) => a.percent - b.percent || a.questionType.localeCompare(b.questionType));
  return stats;
}

/**
 * Score a `reading_questions` attempt for one passage. Simpler than
 * `scoreJlptAttempt` — no sections/pillars, just an overall percent plus a
 * per-question correct/wrong breakdown for review-mode UI.
 */
export function scoreReadingQuiz(questions: ScoredReadingQuestion[], answers: UserAnswers): ReadingQuizResult {
  const perQuestion = questions.map((q) => ({ id: q.id, correct: isAnsweredCorrectly(q, answers) }));
  const correct = perQuestion.reduce((n, p) => n + (p.correct ? 1 : 0), 0);
  const total = questions.length;
  return { correct, total, percent: percentOf(correct, total), perQuestion };
}
