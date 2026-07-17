import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { JlptAttemptResult, JlptQuestionPublic, JlptSubmitResult } from "@/lib/jlpt-ui";
import { JlptResultsPanel } from "./jlpt-results-panel";

const QUESTIONS: JlptQuestionPublic[] = [
  {
    id: "q-1",
    section: "vocab",
    question_type: "kanji-reading",
    order_index: 0,
    question_data: { stem: "「学校」の読み方は？", choices: ["がっこう", "がくこう", "がっこ", "かっこう"] },
  },
  {
    id: "q-2",
    section: "listening",
    question_type: "point-comprehension",
    order_index: 1,
    question_data: { stem: "何時に行きますか。", audio_text: "何時に行きますか。", choices: ["9時", "10時", "11時", "12時"] },
  },
];

function fullResult(overrides: Partial<JlptAttemptResult> = {}): JlptAttemptResult {
  return {
    mode: "full",
    level: "N5",
    sections: [
      { section: "vocab", correct: 1, total: 1, percent: 100 },
      { section: "listening", correct: 0, total: 1, percent: 0 },
    ],
    totalCorrect: 1,
    totalQuestions: 2,
    totalPercent: 50,
    pillars: [
      {
        pillar: "language_knowledge_reading",
        sections: ["vocab", "grammar", "reading"],
        correct: 1,
        total: 1,
        percent: 100,
        scaledScore: 120,
        scaleMax: 120,
        sectionalMinimum: 38,
        meetsMinimum: true,
      },
      {
        pillar: "listening",
        sections: ["listening"],
        correct: 0,
        total: 1,
        percent: 0,
        scaledScore: 0,
        scaleMax: 60,
        sectionalMinimum: 19,
        meetsMinimum: false,
      },
    ],
    scaledTotal: 120,
    scaledTotalMax: 180,
    passThreshold: 80,
    passed: false,
    passUnavailableReason: null,
    ...overrides,
  };
}

function submitResult(overrides: Partial<JlptSubmitResult> = {}): JlptSubmitResult {
  return {
    result: fullResult(),
    weakness: [{ questionType: "point-comprehension", section: "listening", correct: 0, total: 1, percent: 0 }],
    perQuestion: [
      { id: "q-1", correct: true, correctAnswer: "0", explanation: "がっこう is the standard reading." },
      { id: "q-2", correct: false, correctAnswer: "1", explanation: null },
    ],
    attemptId: "attempt-1",
    ...overrides,
  };
}

describe("JlptResultsPanel", () => {
  it("shows the scaled total and a clearly-labeled pass/fail estimate", () => {
    render(
      <JlptResultsPanel submitResult={submitResult()} questions={QUESTIONS} answers={{ q1: "0" }} level="N5" />,
    );
    // getByText matches on an element's own direct text-node children, so
    // the scaled-total number (120) and the nested "/ scaledTotalMax" span
    // ("/ 180") are queried separately rather than as one concatenated string.
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("/ 180")).toBeInTheDocument();
    // Exact-string match (not a substring regex) so this only matches the
    // leaf <span> and not its ancestor <p>, which also carries the
    // "(unofficial estimate...)" sibling text.
    expect(screen.getByText("Estimated result: Not yet passing")).toBeInTheDocument();
    expect(screen.getAllByText(/unofficial estimate/i).length).toBeGreaterThan(0);
  });

  it("renders the pillar breakdown with sectional-minimum indicators", () => {
    render(
      <JlptResultsPanel submitResult={submitResult()} questions={QUESTIONS} answers={{}} level="N5" />,
    );
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    // Exact-string match — avoids ambiguously also matching the ancestor
    // span that concatenates the score with this indicator text.
    expect(screen.getByText("✓ meets minimum")).toBeInTheDocument();
    expect(screen.getByText("below minimum")).toBeInTheDocument();
  });

  it("handles the section-mode / passed:null case without crashing and explains why", () => {
    const result = submitResult({
      result: {
        ...fullResult(),
        mode: "section",
        pillars: null,
        scaledTotal: null,
        scaledTotalMax: null,
        passThreshold: null,
        passed: null,
        passUnavailableReason: "Pass/fail estimate requires mode 'full' (all sections scored together).",
      },
    });
    render(<JlptResultsPanel submitResult={result} questions={QUESTIONS} answers={{}} level="N5" />);

    expect(screen.getByText(/pass\/fail estimate unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/requires mode 'full'/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows per-section correct/total", () => {
    render(<JlptResultsPanel submitResult={submitResult()} questions={QUESTIONS} answers={{}} level="N5" />);
    expect(screen.getByText("1 / 1 (100%)")).toBeInTheDocument();
    expect(screen.getByText("0 / 1 (0%)")).toBeInTheDocument();
  });

  it("lists weakness stats weakest-first with a review link scoped to the section and level", () => {
    render(<JlptResultsPanel submitResult={submitResult()} questions={QUESTIONS} answers={{}} level="N5" />);
    expect(screen.getByText("point-comprehension")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /suggested review/i });
    expect(link).toHaveAttribute("href", "/en/videos?level=N5");
  });

  it("renders the per-question review with your answer, correctness, and explanation", () => {
    render(
      <JlptResultsPanel
        submitResult={submitResult()}
        questions={QUESTIONS}
        answers={{ "q-1": "0", "q-2": "0" }}
        level="N5"
      />,
    );
    expect(screen.getByText(/your answer: がっこう/i)).toBeInTheDocument();
    expect(screen.getByText(/your answer: 9時/i)).toBeInTheDocument();
    expect(screen.getByText(/correct answer: 10時/i)).toBeInTheDocument();
    expect(screen.getByText(/がっこう is the standard reading/i)).toBeInTheDocument();
  });

  it("shows 'Not answered' for a question the user skipped", () => {
    render(<JlptResultsPanel submitResult={submitResult()} questions={QUESTIONS} answers={{}} level="N5" />);
    expect(screen.getAllByText(/your answer: not answered/i).length).toBeGreaterThan(0);
  });
});
