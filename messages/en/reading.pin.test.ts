import { describe, expect, it } from "vitest";
import en from "./reading.json";

/**
 * Characterization test for `reading.json` (Task 14): a literal `toBe` pin
 * for every `reading.*` leaf, copied verbatim from the pre-extraction source
 * of `app/[locale]/(app)/reading/page.tsx`, `components/reading/furigana-toggle.tsx`,
 * `components/reading/reading-body.tsx`, `components/reading/reading-detail.tsx`,
 * `components/reading/reading-list.tsx`, `components/reading/reading-quiz.tsx`,
 * `components/reading/translation-disclosure.tsx`, and
 * `components/reading/word-lookup-popover.tsx` on `layer-9a-string-extraction`
 * before Task 14 (never derived from the catalog itself — binding pattern 2).
 * `toHaveTextContent` given a string is a CONTAINMENT match, not equality, so
 * this file's job — distinct from the RTL wiring tests — is to pin every
 * leaf byte-exact.
 *
 * Reading passages, their translations, and Japanese word/reading data are
 * CONTENT (spec D8) and are never in this catalog — only the UI chrome is
 * pinned here.
 */
describe("reading.json EN — reading/page.tsx", () => {
  it("pins the page title and subtitle", () => {
    expect(en.page.title).toBe("Reading passages");
    expect(en.page.subtitle).toBe(
      "Practice Japanese reading comprehension by JLPT level, with quiz questions and tap-to-lookup right in the passage.",
    );
  });
});

describe("reading.json EN — reading-list.tsx", () => {
  it("pins the filter aria-label, All pill, loading/error/empty states, and the read-passage link", () => {
    expect(en.list.filterAria).toBe("Filter by JLPT level");
    expect(en.list.all).toBe("All");
    expect(en.list.loading).toBe("Loading reading passages…");
    expect(en.list.errorLoad).toBe("Could not load reading passages. Please try again.");
    expect(en.list.emptyAll).toBe("No reading passages yet.");
    expect(en.list.emptyAtLevel).toBe("No reading passages at this level yet.");
    expect(en.list.readPassage).toBe("Read passage");
  });
});

describe("reading.json EN — reading-detail.tsx", () => {
  it("pins the back link, loading/not-found/error states, and the quiz heading", () => {
    expect(en.detail.back).toBe("← All reading passages");
    expect(en.detail.loading).toBe("Loading passage…");
    expect(en.detail.notFound).toBe("Passage not found.");
    expect(en.detail.errorLoad).toBe("Could not load this passage. Please try again.");
    expect(en.detail.quizHeading).toBe("Comprehension quiz");
  });
});

describe("reading.json EN — shared word-count copy (reading-list.tsx + reading-detail.tsx)", () => {
  it("pins the word count and the unknown fallback", () => {
    expect(en.wordCount).toBe("{count} words");
    expect(en.wordCountUnknown).toBe("Word count unknown");
  });
});

describe("reading.json EN — reading-body.tsx", () => {
  it("pins the passage heading and the no-furigana note", () => {
    expect(en.body.heading).toBe("Passage");
    expect(en.body.noFurigana).toBe(
      "No furigana data for this passage — look up by sentence instead of by word.",
    );
  });
});

describe("reading.json EN — furigana-toggle.tsx", () => {
  it("pins the show/hide/unavailable labels and the disabled title", () => {
    expect(en.furigana.show).toBe("Show furigana");
    expect(en.furigana.hide).toBe("Hide furigana");
    expect(en.furigana.unavailable).toBe("Furigana unavailable");
    expect(en.furigana.unavailableTitle).toBe("No furigana data for this passage");
  });
});

describe("reading.json EN — translation-disclosure.tsx", () => {
  it("pins the Show translation summary label (the translation text itself is content, never pinned here)", () => {
    expect(en.translation.show).toBe("Show translation");
  });
});

describe("reading.json EN — word-lookup-popover.tsx", () => {
  it("pins the look-up aria-label template, close label, add-to-flashcard button, and its disabled explanation", () => {
    expect(en.wordLookup.lookUp).toBe("Look up: {word}");
    expect(en.wordLookup.close).toBe("Close");
    expect(en.wordLookup.addToFlashcard).toBe("Add to flashcard");
    expect(en.wordLookup.addToFlashcardExplanation).toBe(
      "Adding flashcards from reading passages isn't supported yet — this currently only works when looking up words in a video.",
    );
  });
});

describe("reading.json EN — reading-quiz.tsx", () => {
  it("pins the no-questions state and the question label/aria-label templates", () => {
    expect(en.quiz.noQuestions).toBe("This passage has no questions yet.");
    expect(en.quiz.questionLabel).toBe("Question {index}.");
    expect(en.quiz.questionAriaLabel).toBe("Question {index}");
  });

  it("pins the correct-answer badge and the correct/incorrect result labels", () => {
    expect(en.quiz.correctAnswerBadge).toBe("(Correct answer)");
    expect(en.quiz.correct).toBe("Correct");
    expect(en.quiz.incorrect).toBe("Incorrect");
  });

  it("pins the submit button states, the answered-count template, and the result summary template", () => {
    expect(en.quiz.submitting).toBe("Submitting…");
    expect(en.quiz.submit).toBe("Submit answers");
    expect(en.quiz.answeredCount).toBe("Answered {answered}/{total} questions");
    expect(en.quiz.resultSummary).toBe("{correct} / {total} correct ({percent}%)");
  });

  it("pins the 429 rate-limit messages and the generic submit-error fallback", () => {
    expect(en.quiz.errorRateLimitWithSeconds).toBe("Too many submissions — try again in {seconds}s.");
    expect(en.quiz.errorRateLimit).toBe("Too many submissions — please wait a moment and try again.");
    expect(en.quiz.errorSubmitFallback).toBe("Could not submit your answers. Please try again.");
  });
});
