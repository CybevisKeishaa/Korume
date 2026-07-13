import { describe, expect, it } from "vitest";
import {
  scoreJlptAttempt,
  scoreSections,
  weaknessStats,
  scoreReadingQuiz,
  PILLAR_STRUCTURE,
  PASS_THRESHOLD,
  SECTION_ORDER,
  SCALED_TOTAL_MAX,
} from "./score";
import type { JlptLevel, JlptSection, ScoredQuestion, ScoredReadingQuestion, UserAnswers } from "./types";

/** Build `n` questions for one section/question_type, answer key alternating "0". */
function makeQuestions(
  section: JlptSection,
  questionType: string,
  n: number,
  idPrefix: string,
): ScoredQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${idPrefix}-${i}`,
    section,
    question_type: questionType,
    correct_answer: "0",
    order_index: i,
  }));
}

/** Answer the first `correctCount` questions correctly ("0"), the rest wrong ("1"). */
function answerFirstNCorrect(questions: ScoredQuestion[] | ScoredReadingQuestion[], correctCount: number): UserAnswers {
  const answers: UserAnswers = {};
  questions.forEach((q, i) => {
    answers[q.id] = i < correctCount ? "0" : "1";
  });
  return answers;
}

describe("scoreSections", () => {
  it("groups by section in canonical order regardless of input order", () => {
    const questions: ScoredQuestion[] = [
      ...makeQuestions("listening", "task-comprehension", 2, "l"),
      ...makeQuestions("vocab", "kanji-reading", 3, "v"),
    ];
    const answers = answerFirstNCorrect(questions, 3); // 2 listening correct (index 0,1), 1 vocab correct
    const sections = scoreSections(questions, answers);
    expect(sections.map((s) => s.section)).toEqual(["vocab", "listening"]);
  });

  it("computes correct/total/percent per section", () => {
    const questions = makeQuestions("vocab", "kanji-reading", 4, "v");
    const answers = answerFirstNCorrect(questions, 3);
    const sections = scoreSections(questions, answers);
    expect(sections).toEqual([{ section: "vocab", correct: 3, total: 4, percent: 75 }]);
  });

  it("returns an empty array for no questions", () => {
    expect(scoreSections([], {})).toEqual([]);
  });

  it("treats a missing answer key as wrong", () => {
    const questions = makeQuestions("grammar", "grammar-form", 2, "g");
    const sections = scoreSections(questions, {});
    expect(sections).toEqual([{ section: "grammar", correct: 0, total: 2, percent: 0 }]);
  });

  it("ignores unknown question ids present in answers", () => {
    const questions = makeQuestions("grammar", "grammar-form", 1, "g");
    const answers: UserAnswers = { "g-0": "0", "does-not-exist": "0" };
    const sections = scoreSections(questions, answers);
    expect(sections).toEqual([{ section: "grammar", correct: 1, total: 1, percent: 100 }]);
  });
});

describe("scoreJlptAttempt — section mode", () => {
  it("returns no pass estimate; percent + sections are still computed", () => {
    const questions = makeQuestions("vocab", "kanji-reading", 4, "v");
    const answers = answerFirstNCorrect(questions, 2);
    const result = scoreJlptAttempt(questions, answers, "section", "N5");
    expect(result.mode).toBe("section");
    expect(result.sections).toEqual([{ section: "vocab", correct: 2, total: 4, percent: 50 }]);
    expect(result.totalCorrect).toBe(2);
    expect(result.totalQuestions).toBe(4);
    expect(result.totalPercent).toBe(50);
    expect(result.pillars).toBeNull();
    expect(result.scaledTotal).toBeNull();
    expect(result.passed).toBeNull();
    expect(result.passUnavailableReason).toMatch(/full/i);
  });
});

describe("scoreJlptAttempt — full mode, N5/N4 combined pillar structure", () => {
  // Combined language_knowledge_reading pillar (vocab+grammar+reading) sized
  // to exactly 120 questions and listening sized to exactly 60, so each
  // correct answer moves the scaled score by exactly 1 point (1:1 with the
  // official 0-120 / 0-60 scale) — makes boundary math exact and readable.
  function buildN5Set(): ScoredQuestion[] {
    return [
      ...makeQuestions("vocab", "kanji-reading", 40, "v"),
      ...makeQuestions("grammar", "grammar-form", 40, "g"),
      ...makeQuestions("reading", "short-passage", 40, "r"),
      ...makeQuestions("listening", "task-comprehension", 60, "l"),
    ];
  }

  it("passes exactly at the published boundary (combined 61/120, listening 19/60 => total 80)", () => {
    const questions = buildN5Set();
    // Build answers precisely per-pillar (pillar order != array order).
    const preciseAnswers: UserAnswers = {};
    const combined = questions.filter((q) => q.section !== "listening");
    const listening = questions.filter((q) => q.section === "listening");
    combined.forEach((q, i) => {
      preciseAnswers[q.id] = i < 61 ? "0" : "1";
    });
    listening.forEach((q, i) => {
      preciseAnswers[q.id] = i < 19 ? "0" : "1";
    });

    const result = scoreJlptAttempt(questions, preciseAnswers, "full", "N5");
    expect(result.pillars).not.toBeNull();
    expect(result.scaledTotal).toBe(80);
    expect(result.passThreshold).toBe(80);
    expect(result.passed).toBe(true);
  });

  it("fails one point below the boundary (combined 60/120, listening 19/60 => total 79)", () => {
    const questions = buildN5Set();
    const preciseAnswers: UserAnswers = {};
    const combined = questions.filter((q) => q.section !== "listening");
    const listening = questions.filter((q) => q.section === "listening");
    combined.forEach((q, i) => {
      preciseAnswers[q.id] = i < 60 ? "0" : "1";
    });
    listening.forEach((q, i) => {
      preciseAnswers[q.id] = i < 19 ? "0" : "1";
    });

    const result = scoreJlptAttempt(questions, preciseAnswers, "full", "N5");
    expect(result.scaledTotal).toBe(79);
    expect(result.passed).toBe(false);
  });

  it("fails when total meets the threshold but a pillar misses its sectional minimum", () => {
    const questions = buildN5Set();
    const preciseAnswers: UserAnswers = {};
    const combined = questions.filter((q) => q.section !== "listening");
    const listening = questions.filter((q) => q.section === "listening");
    // Combined pillar aces everything (120/120 = scaled 120, well above min 38).
    combined.forEach((q) => {
      preciseAnswers[q.id] = "0";
    });
    // Listening: only 10/60 correct => scaled 10, below its minimum of 19.
    listening.forEach((q, i) => {
      preciseAnswers[q.id] = i < 10 ? "0" : "1";
    });
    // Total scaled = 120 + 10 = 130, comfortably >= 80, but listening fails its minimum.
    const result = scoreJlptAttempt(questions, preciseAnswers, "full", "N5");
    expect(result.scaledTotal).toBe(130);
    expect(result.scaledTotal).toBeGreaterThanOrEqual(80);
    expect(result.pillars?.find((p) => p.pillar === "listening")?.meetsMinimum).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("all-correct passes and all-wrong fails", () => {
    const questions = buildN5Set();
    const allCorrect = answerFirstNCorrect(questions, questions.length);
    const allWrong: UserAnswers = {};
    expect(scoreJlptAttempt(questions, allCorrect, "full", "N5").passed).toBe(true);
    expect(scoreJlptAttempt(questions, allWrong, "full", "N5").passed).toBe(false);
  });
});

describe("scoreJlptAttempt — full mode, N3-N1 three-pillar structure", () => {
  function buildThreePillarSet(): ScoredQuestion[] {
    return [
      ...makeQuestions("vocab", "kanji-reading", 30, "v"),
      ...makeQuestions("grammar", "grammar-form", 30, "g"),
      ...makeQuestions("reading", "medium-passage", 60, "r"),
      ...makeQuestions("listening", "point-comprehension", 60, "l"),
    ];
  }

  it("scores each of the three pillars independently against the level's threshold (N2 = 90)", () => {
    const questions = buildThreePillarSet();
    const preciseAnswers: UserAnswers = {};
    const lk = questions.filter((q) => q.section === "vocab" || q.section === "grammar");
    const reading = questions.filter((q) => q.section === "reading");
    const listening = questions.filter((q) => q.section === "listening");
    lk.forEach((q, i) => {
      preciseAnswers[q.id] = i < 40 ? "0" : "1"; // 40/60 scaled 40
    });
    reading.forEach((q, i) => {
      preciseAnswers[q.id] = i < 30 ? "0" : "1"; // 30/60 scaled 30
    });
    listening.forEach((q, i) => {
      preciseAnswers[q.id] = i < 20 ? "0" : "1"; // 20/60 scaled 20
    });
    // total scaled = 90, all three pillars (40, 30, 20) >= minimum 19.
    const result = scoreJlptAttempt(questions, preciseAnswers, "full", "N2");
    expect(result.scaledTotal).toBe(90);
    expect(result.passThreshold).toBe(90);
    expect(result.pillars?.every((p) => p.meetsMinimum)).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("uses the published totals for N3 (95) and N1 (100)", () => {
    expect(PASS_THRESHOLD.N3).toBe(95);
    expect(PASS_THRESHOLD.N1).toBe(100);
  });
});

describe("scoreJlptAttempt — insufficient data for a pass estimate", () => {
  it("returns passed: null when a pillar has zero questions", () => {
    // N3 needs vocab, grammar, reading, listening; omit listening entirely.
    const questions: ScoredQuestion[] = [
      ...makeQuestions("vocab", "kanji-reading", 10, "v"),
      ...makeQuestions("grammar", "grammar-form", 10, "g"),
      ...makeQuestions("reading", "medium-passage", 10, "r"),
    ];
    const answers = answerFirstNCorrect(questions, questions.length);
    const result = scoreJlptAttempt(questions, answers, "full", "N3");
    expect(result.passed).toBeNull();
    expect(result.scaledTotal).toBeNull();
    expect(result.passUnavailableReason).toMatch(/listening/i);
    // Sections/percent are still fully computed even though pass estimate is unavailable.
    expect(result.totalQuestions).toBe(30);
    expect(result.totalCorrect).toBe(30);
  });

  it("returns passed: null with all-zero counts for an empty question set", () => {
    const result = scoreJlptAttempt([], {}, "full", "N5");
    expect(result.sections).toEqual([]);
    expect(result.totalQuestions).toBe(0);
    expect(result.totalCorrect).toBe(0);
    expect(result.totalPercent).toBe(0);
    expect(result.passed).toBeNull();
    expect(result.passUnavailableReason).toBeTruthy();
  });
});

describe("scoreJlptAttempt — determinism", () => {
  it("is deterministic across repeated calls with the same input", () => {
    const questions = [
      ...makeQuestions("vocab", "kanji-reading", 5, "v"),
      ...makeQuestions("listening", "task-comprehension", 5, "l"),
    ];
    const answers = answerFirstNCorrect(questions, 6);
    const a = scoreJlptAttempt(questions, answers, "section", "N5");
    const b = scoreJlptAttempt(questions, answers, "section", "N5");
    expect(a).toEqual(b);
  });
});

describe("scoreJlptAttempt — exported constants", () => {
  it("exposes the canonical section order", () => {
    expect(SECTION_ORDER).toEqual(["vocab", "grammar", "reading", "listening"]);
  });

  it("exposes the scaled-total ceiling", () => {
    expect(SCALED_TOTAL_MAX).toBe(180);
  });

  it("N5 and N4 share the combined-pillar structure with their published thresholds (N5 80, N4 90)", () => {
    const levels: JlptLevel[] = ["N5", "N4"];
    for (const level of levels) {
      expect(PILLAR_STRUCTURE[level].map((p) => p.pillar)).toEqual(["language_knowledge_reading", "listening"]);
    }
    expect(PASS_THRESHOLD.N5).toBe(80);
    expect(PASS_THRESHOLD.N4).toBe(90);
  });

  it("N3-N1 each use three independent pillars", () => {
    const levels: JlptLevel[] = ["N3", "N2", "N1"];
    for (const level of levels) {
      expect(PILLAR_STRUCTURE[level].map((p) => p.pillar)).toEqual(["language_knowledge", "reading", "listening"]);
    }
  });
});

describe("weaknessStats", () => {
  it("groups by question_type and sorts weakest (lowest percent) first", () => {
    const questions: ScoredQuestion[] = [
      ...makeQuestions("vocab", "kanji-reading", 4, "kr"), // will score 100%
      ...makeQuestions("grammar", "grammar-form", 4, "gf"), // will score 25%
      ...makeQuestions("reading", "short-passage", 4, "sp"), // will score 50%
    ];
    const answers: UserAnswers = {};
    questions.filter((q) => q.question_type === "kanji-reading").forEach((q) => (answers[q.id] = "0"));
    questions
      .filter((q) => q.question_type === "grammar-form")
      .forEach((q, i) => (answers[q.id] = i < 1 ? "0" : "1"));
    questions
      .filter((q) => q.question_type === "short-passage")
      .forEach((q, i) => (answers[q.id] = i < 2 ? "0" : "1"));

    const stats = weaknessStats(questions, answers);
    expect(stats.map((s) => s.questionType)).toEqual(["grammar-form", "short-passage", "kanji-reading"]);
    expect(stats[0]).toEqual({ questionType: "grammar-form", section: "grammar", correct: 1, total: 4, percent: 25 });
  });

  it("breaks ties in percent alphabetically by question_type for determinism", () => {
    const questions: ScoredQuestion[] = [
      ...makeQuestions("vocab", "orthography", 2, "o"),
      ...makeQuestions("vocab", "context", 2, "c"),
    ];
    // Both score 50% (1/2 correct).
    const answers: UserAnswers = { "o-0": "0", "o-1": "1", "c-0": "0", "c-1": "1" };
    const stats = weaknessStats(questions, answers);
    expect(stats.map((s) => s.questionType)).toEqual(["context", "orthography"]);
  });

  it("returns an empty array for no questions", () => {
    expect(weaknessStats([], {})).toEqual([]);
  });
});

describe("scoreReadingQuiz", () => {
  function makeReadingQuestions(n: number): ScoredReadingQuestion[] {
    return Array.from({ length: n }, (_, i) => ({ id: `rq-${i}`, correct_answer: "0" }));
  }

  it("scores correct/total/percent and a per-question breakdown", () => {
    const questions = makeReadingQuestions(4);
    const answers = answerFirstNCorrect(questions, 3);
    const result = scoreReadingQuiz(questions, answers);
    expect(result).toEqual({
      correct: 3,
      total: 4,
      percent: 75,
      perQuestion: [
        { id: "rq-0", correct: true },
        { id: "rq-1", correct: true },
        { id: "rq-2", correct: true },
        { id: "rq-3", correct: false },
      ],
    });
  });

  it("treats a missing answer as wrong and ignores unknown ids", () => {
    const questions = makeReadingQuestions(2);
    const answers: UserAnswers = { "rq-0": "0", "unknown-id": "0" };
    const result = scoreReadingQuiz(questions, answers);
    expect(result.correct).toBe(1);
    expect(result.perQuestion).toEqual([
      { id: "rq-0", correct: true },
      { id: "rq-1", correct: false },
    ]);
  });

  it("handles an empty question set without dividing by zero", () => {
    expect(scoreReadingQuiz([], {})).toEqual({ correct: 0, total: 0, percent: 0, perQuestion: [] });
  });

  it("is deterministic across repeated calls", () => {
    const questions = makeReadingQuestions(3);
    const answers = answerFirstNCorrect(questions, 2);
    expect(scoreReadingQuiz(questions, answers)).toEqual(scoreReadingQuiz(questions, answers));
  });
});
