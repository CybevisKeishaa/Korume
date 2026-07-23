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
});
