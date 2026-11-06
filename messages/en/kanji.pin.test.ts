import { describe, expect, it } from "vitest";
import en from "./kanji.json";
import common from "./common.json";

/**
 * Characterization test for the three kanji pages' strings
 * (`app/[locale]/(app)/kanji/{page,[id]/page,review/page}.tsx`), all async
 * Server Components with no RTL unit test (they call `getKanjiList` /
 * `getKanjiById` / `getReviewQueue`, which need a running Supabase — see the
 * e2e specs, which only assert on rendered SRS-review copy from
 * `review-session.tsx`, never these pages' own strings). Binding pattern 1
 * still requires every extracted string to be pinned, so this test does that
 * directly against the catalog: the SUBJECT under test is
 * `messages/en/kanji.json`, but every expected value below is a literal
 * copied verbatim from the pre-extraction source of the three page files on
 * `layer-9a-string-extraction` before Task 7 (never derived from the catalog
 * itself — binding pattern 2).
 */
describe("kanji.json EN — page.tsx literals", () => {
  it("pins the list page heading and empty state", () => {
    expect(en.title).toBe("Kanji");
    expect(en.empty).toBe("No kanji at this level yet.");
  });

  it("pins the list page's Review link, promoted to common.actions.review (Task 8: vocab needs the identical string)", () => {
    expect(common.actions.review).toBe("Review");
  });

  it("pins the list page's character-count subtitle as a real plural", () => {
    expect(en.subtitleCount).toBe(
      "{count, plural, one {{count} character} other {{count} characters}}",
    );
  });

  it("pins the detail page's back link, reading labels, and mnemonic heading", () => {
    expect(en.backToList).toBe("← All kanji");
    expect(en.onReading).toBe("On");
    expect(en.kunReading).toBe("Kun");
    expect(en.mnemonic).toBe("Mnemonic");
  });

  it("pins the detail page's stroke-count subtitle as a real plural", () => {
    expect(en.strokeCount).toBe(
      "{count, plural, one {{count} stroke} other {{count} strokes}}",
    );
  });

  it("pins the review page's heading", () => {
    expect(en.reviewTitle).toBe("Kanji review");
  });

  it("pins the stroke-order aria-label (components/motion/stroke-order.tsx, rendered on the detail page)", () => {
    expect(en.a11y.strokeOrder).toBe("Stroke order for {character}");
  });

  it("pins the dictionary-backed detail page copy (Part 1b §6.5)", () => {
    expect(en.grade).toBe("Grade {grade}");
    expect(en.frequency).toBe("Frequency #{rank}");
    expect(en.commonWords).toBe("Common words");
    expect(en.dictionarySources).toBe("Dictionary data");
  });
});

describe("kanji.json EN quickInspect", () => {
  it("pins the KanjiQuickInspect copy", () => {
    expect(en.quickInspect).toEqual({"label": "Kanji {literal}", "loading": "Loading kanji…", "failed": "Couldn't load this kanji.", "replay": "Replay strokes", "listen": "Listen to {reading}", "ttsUnavailable": "Speech is not available right now", "jlpt": "JLPT {level}", "viewFullDetails": "View full details"});
  });
});

describe("kanji.json EN inspect (port-kanji Task 7, Figma 28:2041 copy)", () => {
  it("pins the inspect content and the saved strip", () => {
    expect(en.saved).toBe("Saved kanji");
    expect(en.inspect).toEqual({"openPage": "Open its own page", "prev": "Previous kanji", "next": "Next kanji", "close": "Close", "favorite": "Favorite", "addToReview": "Add to Review", "inReview": "In review", "actionFailed": "Couldn't save. Try again.", "rateLimited": "Too many requests — try again in {seconds}s.", "strokeOrder": "Stroke order", "meaning": "Meaning", "hanViet": "Hán Việt", "status": "My status", "stage": "SRS stage", "reviews": "Reviews", "nextReview": "Next review", "dueNow": "Now", "recalled": "{percent}% recalled", "reviewNow": "Review Now", "notInReview": "Not in your review deck yet.", "thieuChuu": "Classical meaning (Thiều Chửu)", "showAll": "Show all {count} lines", "showLess": "Show less", "composition": "Composition", "usage": "Words and lessons", "examples": "Examples", "lessons": "In lessons", "moreExamples": "View more examples", "previousExamples": "Previous examples", "noMoreExamples": "No more examples", "fromLesson": "from {title}", "times": "{count, plural, one {# time} other {# times}}", "noLessons": "This kanji is not in any of your lessons yet.", "study": "Study this Kanji", "studyHint": "Focus learning", "vocab": "Open Vocabulary", "vocabHint": "See related words", "writing": "Practice Writing", "writingHint": "Stroke practice", "similar": "Find Similar Kanji", "similarHint": "Explore related", "words": "Words", "examplesFailed": "Couldn't load more examples.", "favorited": "Added to favorites.", "unfavorited": "Removed from favorites.", "addedToReview": "Added to your review deck."});
  });
});
