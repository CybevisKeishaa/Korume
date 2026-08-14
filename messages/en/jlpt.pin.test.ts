import { describe, expect, it } from "vitest";
import en from "./jlpt.json";

/**
 * Characterization test for `jlpt.json` (Task 13): a literal `toBe` pin for
 * every `jlpt.*` leaf, copied verbatim from the pre-extraction source of
 * `app/[locale]/(app)/certification/page.tsx`, `components/jlpt/jlpt-attempt-list.tsx`,
 * `components/jlpt/jlpt-pre-start-panel.tsx`, `components/jlpt/jlpt-test-card.tsx`,
 * `components/jlpt/jlpt-test-list.tsx`, `components/jlpt/jlpt-question-card.tsx`,
 * `components/jlpt/jlpt-question-navigator.tsx`, `components/jlpt/jlpt-results-panel.tsx`,
 * `components/jlpt/jlpt-timer.tsx`, `components/jlpt/jlpt-listening-play-button.tsx`,
 * `components/jlpt/jlpt-test-runner.tsx`, and `lib/jlpt-ui.ts`'s deleted
 * `SECTION_LABELS`/`PILLAR_LABELS` maps, on `layer-9a-string-extraction`
 * before Task 13 (never derived from the catalog itself — binding pattern
 * 2). `toHaveTextContent` given a string is a CONTAINMENT match, not
 * equality, so this file's job — distinct from the RTL wiring tests — is to
 * pin every leaf byte-exact.
 */
describe("jlpt.json EN — jlpt/page.tsx", () => {
  it("pins the page title, subtitle count, and Recent attempts heading", () => {
    expect(en.title).toBe("JLPT mock tests");
    expect(en.subtitleCount).toBe("{count, plural, one {{count} test} other {{count} tests}}");
    expect(en.recentAttempts).toBe("Recent attempts");
  });
});

describe("jlpt.json EN — lib/jlpt-ui.ts's deleted SECTION_LABELS/PILLAR_LABELS", () => {
  it("pins the four section names", () => {
    expect(en.sections.vocab).toBe("Vocabulary");
    expect(en.sections.grammar).toBe("Grammar");
    expect(en.sections.reading).toBe("Reading");
    expect(en.sections.listening).toBe("Listening");
  });

  it("pins the four pillar names", () => {
    expect(en.pillars.language_knowledge).toBe("Language knowledge");
    expect(en.pillars.reading).toBe("Reading");
    expect(en.pillars.listening).toBe("Listening");
    expect(en.pillars.language_knowledge_reading).toBe("Language knowledge + Reading");
  });
});

describe("jlpt.json EN — jlpt-attempt-list.tsx", () => {
  it("pins the empty state, unknown-test fallback, full-mock label, and section label", () => {
    expect(en.attemptList.empty).toBe(
      "No attempts yet — take a test above to see your score history here.",
    );
    expect(en.attemptList.unknownTest).toBe("Unknown test");
    expect(en.attemptList.fullMock).toBe("Full mock");
    expect(en.attemptList.sectionLabel).toBe("Section: {section}");
  });
});

describe("jlpt.json EN — jlpt-pre-start-panel.tsx", () => {
  it("pins the full-mock and section-practice descriptions", () => {
    expect(en.preStart.fullMockDescription).toBe("Full mock test — all sections.");
    expect(en.preStart.sectionPracticeDescription).toBe("Section practice — {section}.");
  });

  it("pins the Questions / Time limit labels and the minutes value", () => {
    expect(en.preStart.questionsLabel).toBe("Questions");
    expect(en.preStart.timeLimitLabel).toBe("Time limit");
    expect(en.preStart.durationMinutes).toBe("{minutes} min");
  });

  it("pins the instructions paragraph and Start button", () => {
    expect(en.preStart.instructions).toBe(
      "The timer starts as soon as you click Start and submits automatically when it runs out. You can move between questions freely and change your answers until you submit.",
    );
    expect(en.preStart.start).toBe("Start");
  });
});

describe("jlpt.json EN — jlpt-test-card.tsx", () => {
  it("pins the section summary line and the full-mock/practice link labels", () => {
    expect(en.testCard.sectionSummary).toBe("{count} questions · {minutes} min");
    expect(en.testCard.takeFullMock).toBe("Take full mock");
    expect(en.testCard.practiceSection).toBe("Practice {section}");
  });
});

describe("jlpt.json EN — jlpt-test-list.tsx", () => {
  it("pins the empty-list message", () => {
    expect(en.testList.empty).toBe("No JLPT tests at this level yet.");
  });
});

describe("jlpt.json EN — jlpt-question-card.tsx", () => {
  it("pins the question heading, reading-passage summary, choices aria-label, and selected suffix", () => {
    expect(en.questionCard.heading).toBe("Question {index} / {total}");
    expect(en.questionCard.readingPassage).toBe("Reading passage");
    expect(en.questionCard.answerChoicesAria).toBe("Answer choices for question {index}");
    expect(en.questionCard.selected).toBe(" (selected)");
  });
});

describe("jlpt.json EN — jlpt-question-navigator.tsx", () => {
  it("pins the nav aria-label and the per-item aria-label fragments", () => {
    expect(en.navigator.aria).toBe("Question navigator");
    expect(en.navigator.item).toBe("Question {index}");
    expect(en.navigator.current).toBe("current");
    expect(en.navigator.answered).toBe("answered");
    expect(en.navigator.notAnswered).toBe("not answered");
  });
});

describe("jlpt.json EN — jlpt-results-panel.tsx", () => {
  it("pins the title and the overall score line", () => {
    expect(en.resultsPanel.title).toBe("Results");
    expect(en.resultsPanel.scoreLine).toBe("{correct} / {total} correct ({percent}%)");
  });

  it("pins the pass-estimate section's aria-label, heading, and pass/fail copy", () => {
    expect(en.resultsPanel.passEstimateAria).toBe("Pass estimate");
    expect(en.resultsPanel.estimatedScaledScore).toBe("Estimated scaled score");
    expect(en.resultsPanel.resultPass).toBe("Estimated result: Pass");
    expect(en.resultsPanel.resultNotPassed).toBe("Estimated result: Not yet passing");
    expect(en.resultsPanel.unofficialEstimate).toBe(
      "(unofficial estimate — not an official JLPT score)",
    );
  });

  it("pins the meets/below-minimum indicators, including the literal checkmark", () => {
    expect(en.resultsPanel.meetsMinimum).toBe("✓ meets minimum");
    expect(en.resultsPanel.belowMinimum).toBe("below minimum");
  });

  it("pins the pillar-bar aria-label and the sectional-minimum tooltip", () => {
    expect(en.resultsPanel.pillarScaledScoreAria).toBe("{pillar} scaled score");
    expect(en.resultsPanel.sectionalMinimum).toBe("Sectional minimum: {value}");
  });

  it("pins the pass-unavailable message (the reason itself is server data, not a catalog key)", () => {
    expect(en.resultsPanel.passUnavailable).toBe("Pass/fail estimate unavailable");
  });

  it("pins the Section scores heading/aria-label and its per-section line", () => {
    expect(en.resultsPanel.sectionScores).toBe("Section scores");
    expect(en.resultsPanel.sectionScoreLine).toBe("{correct} / {total} ({percent}%)");
  });

  it("pins the Where to focus heading, its aria-label, the weakness line, and the review link", () => {
    expect(en.resultsPanel.weaknessBreakdownAria).toBe("Weakness breakdown");
    expect(en.resultsPanel.whereToFocus).toBe("Where to focus");
    expect(en.resultsPanel.weaknessLine).toBe("{section} · {correct} / {total} correct ({percent}%)");
    expect(en.resultsPanel.suggestedReview).toBe("Suggested review");
  });

  it("pins the Question review heading/aria-label, per-question number, and sr-only correctness", () => {
    expect(en.resultsPanel.questionReview).toBe("Question review");
    expect(en.resultsPanel.questionNumber).toBe("Question {index}");
    expect(en.resultsPanel.correct).toBe("Correct.");
    expect(en.resultsPanel.incorrect).toBe("Incorrect.");
  });

  it("pins the your-answer / correct-answer lines and the not-answered fallback", () => {
    expect(en.resultsPanel.yourAnswer).toBe("Your answer: {answer}");
    expect(en.resultsPanel.notAnswered).toBe("Not answered");
    expect(en.resultsPanel.correctAnswer).toBe("Correct answer: {answer}");
  });

  it("pins the Back to JLPT tests link", () => {
    expect(en.resultsPanel.backToTests).toBe("Back to JLPT tests");
  });
});

describe("jlpt.json EN — jlpt-timer.tsx (a11y group per the brief)", () => {
  it("pins the aria-label and the visible under-1-minute label", () => {
    expect(en.a11y.timeRemaining).toBe("Time remaining");
    expect(en.a11y.underOneMinuteLeft).toBe("Under 1 minute left");
  });

  it("pins the two fixed announcement strings verbatim (not parameterized into ICU)", () => {
    expect(en.a11y.fiveMinutesRemaining).toBe("5 minutes remaining.");
    expect(en.a11y.oneMinuteRemaining).toBe("1 minute remaining.");
  });

  it("pins the expiry announcement", () => {
    expect(en.a11y.timeUp).toBe("Time is up — submitting your answers now.");
  });
});

describe("jlpt.json EN — jlpt-listening-play-button.tsx", () => {
  it("pins the not-configured tooltip and the three button-label states", () => {
    expect(en.listeningPlayButton.notConfigured).toBe("Audio playback isn't set up yet.");
    expect(en.listeningPlayButton.loading).toBe("Loading audio…");
    expect(en.listeningPlayButton.play).toBe("▶ Play audio");
    expect(en.listeningPlayButton.replay).toBe("▶ Replay audio");
  });

  it("pins the 429 and generic error messages, and the jlpt-specific network-error message", () => {
    expect(en.listeningPlayButton.rateLimited).toBe("Too many audio requests — try again shortly.");
    expect(en.listeningPlayButton.genericError).toBe("Couldn't play the audio.");
    expect(en.listeningPlayButton.networkError).toBe("Network error — couldn't play the audio.");
  });
});

describe("jlpt.json EN — jlpt-test-runner.tsx", () => {
  it("pins the full-mock/section-practice mode labels (note the middle dot, not the em dash preStart uses)", () => {
    expect(en.testRunner.fullMockTest).toBe("Full mock test");
    expect(en.testRunner.sectionPractice).toBe("Section practice · {section}");
  });

  it("pins the Previous button (Next reuses common.actions.next, not a jlpt key)", () => {
    expect(en.testRunner.previous).toBe("Previous");
  });

  it("pins the Submit test / Submitting… button states", () => {
    expect(en.testRunner.submitTest).toBe("Submit test");
    expect(en.testRunner.submitting).toBe("Submitting…");
  });

  it("pins the unanswered-questions confirmation plural", () => {
    expect(en.testRunner.confirmSubmit).toBe(
      "{count, plural, one {You have {count} unanswered question. Click Submit again to submit anyway.} other {You have {count} unanswered questions. Click Submit again to submit anyway.}}",
    );
  });

  it("pins the generic submit-failure fallback and the no-questions message", () => {
    expect(en.testRunner.submitFailedGeneric).toBe("Could not submit your test. Please try again.");
    expect(en.testRunner.noQuestions).toBe("This test has no questions to practice yet.");
  });
});
