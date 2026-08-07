import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import type { JlptAttemptResult, JlptQuestionPublic, JlptSubmitResult } from "@/lib/jlpt-ui";
import { JlptResultsPanel } from "./jlpt-results-panel";

/** `Element.closest()` is typed nullable; the swap-guard tests below need a
 * non-null `HTMLElement` to hand to `within()`, so this fails loudly (not a
 * `!` non-null assertion — CLAUDE.md §6 lint discipline) if the selector
 * doesn't match, which would itself mean the test fixture changed shape. */
function closestOrThrow(el: Element, selector: string): HTMLElement {
  const found = el.closest(selector);
  if (!found) throw new Error(`Expected an ancestor matching "${selector}"`);
  return found as HTMLElement;
}

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

  it("pairs each pillar's translated name with ITS OWN score and minimum-status, not the other pillar's (swap guard)", () => {
    // Task 13: `t(\`pillars.${pillar.pillar}\`)` is resolved per-bar from data, not
    // a hardcoded literal — a key/wiring swap (e.g. both bars accidentally
    // reading `pillars.listening`, or a pillar's status crossed with the
    // other pillar's row) would still make every individual `getByText`
    // assertion above pass, since both label strings and both status strings
    // exist SOMEWHERE in the document. Scoping to each bar's own row is what
    // actually catches that class of bug.
    render(
      <JlptResultsPanel submitResult={submitResult()} questions={QUESTIONS} answers={{}} level="N5" />,
    );
    // Scoped to the "Pass estimate" region: "Listening" is also the pillar's
    // NAME (not just the pillar bar's label) and also appears in the Section
    // scores region below for the same fixture, so an unscoped `getByText`
    // would be ambiguous.
    const passEstimate = screen.getByRole("region", { name: "Pass estimate" });
    const languageKnowledgeRow = closestOrThrow(
      within(passEstimate).getByText("Language knowledge + Reading"),
      "div",
    );
    expect(within(languageKnowledgeRow).getByText("120 / 120")).toBeInTheDocument();
    expect(within(languageKnowledgeRow).getByText("✓ meets minimum")).toBeInTheDocument();
    expect(within(languageKnowledgeRow).queryByText("below minimum")).not.toBeInTheDocument();

    const listeningRow = closestOrThrow(within(passEstimate).getByText("Listening"), "div");
    expect(within(listeningRow).getByText("0 / 60")).toBeInTheDocument();
    expect(within(listeningRow).getByText("below minimum")).toBeInTheDocument();
    expect(within(listeningRow).queryByText("✓ meets minimum")).not.toBeInTheDocument();

    expect(screen.getByRole("progressbar", { name: "Language knowledge + Reading scaled score" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Listening scaled score" })).toBeInTheDocument();
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

  it("pairs each section's translated name with ITS OWN score line, not the other section's (swap guard)", () => {
    render(<JlptResultsPanel submitResult={submitResult()} questions={QUESTIONS} answers={{}} level="N5" />);
    // Scoped to the "Section scores" region: "Listening" is also this fixture's
    // pillar name (rendered in the "Pass estimate" region above), so an
    // unscoped `getByText("Listening")` would be ambiguous.
    const sectionScores = screen.getByRole("region", { name: "Section scores" });
    const vocabItem = closestOrThrow(within(sectionScores).getByText("Vocabulary"), "li");
    expect(within(vocabItem).getByText("1 / 1 (100%)")).toBeInTheDocument();

    const listeningItem = closestOrThrow(within(sectionScores).getByText("Listening"), "li");
    expect(within(listeningItem).getByText("0 / 1 (0%)")).toBeInTheDocument();
  });

  it("lists weakness stats weakest-first with a review link scoped to the section and level", () => {
    render(<JlptResultsPanel submitResult={submitResult()} questions={QUESTIONS} answers={{}} level="N5" />);
    expect(screen.getByText("point-comprehension")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /suggested review/i });
    expect(link).toHaveAttribute("href", "/en/shadowing?level=N5");
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

  it("pairs each question's sr-only correctness announcement with ITS OWN outcome, not the other question's (swap guard)", () => {
    // Task 13: q-1 is correct, q-2 is not (see `submitResult()`'s `perQuestion`
    // fixture above). A swap of `resultsPanel.correct`/`resultsPanel.incorrect`
    // (or of which question's `pq.correct` drives which label) would announce
    // the WRONG outcome to a screen-reader user, who has no other way to tell
    // — the ✓/✕ glyph beside it is `aria-hidden`. Scoping each assertion to
    // its own question's <li> is what catches that, not merely that both
    // strings exist somewhere on the page.
    render(
      <JlptResultsPanel
        submitResult={submitResult()}
        questions={QUESTIONS}
        answers={{ "q-1": "0", "q-2": "0" }}
        level="N5"
      />,
    );
    const q1Item = closestOrThrow(screen.getByText("Question 1"), "li");
    expect(within(q1Item).getByText("Correct.")).toBeInTheDocument();
    expect(within(q1Item).queryByText("Incorrect.")).not.toBeInTheDocument();

    const q2Item = closestOrThrow(screen.getByText("Question 2"), "li");
    expect(within(q2Item).getByText("Incorrect.")).toBeInTheDocument();
    expect(within(q2Item).queryByText("Correct.")).not.toBeInTheDocument();
  });
});
