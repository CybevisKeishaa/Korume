import { describe, expect, it } from "vitest";
import en from "./vocab.json";
import common from "./common.json";

/**
 * Characterization test for the three vocab pages' strings
 * (`app/[locale]/(app)/vocab/{page,[id]/page,review/page}.tsx`), all async
 * Server Components with no RTL unit test (they call `getVocabList` /
 * `getVocabById` / `getReviewQueue`, which need a running Supabase — see the
 * e2e specs, which only assert on rendered SRS-review copy from
 * `review-session.tsx`, never these pages' own strings). Mirrors
 * `messages/en/kanji.pin.test.ts`'s shape (Task 7). Binding pattern 1 still
 * requires every extracted string to be pinned, so this test does that
 * directly against the catalog: the SUBJECT under test is
 * `messages/en/vocab.json` (plus `messages/en/common.json` for the shared
 * Review action), but every expected value below is a literal copied
 * verbatim from the pre-extraction source of the three page files on
 * `layer-9a-string-extraction` before Task 8 (never derived from the
 * catalog itself — binding pattern 2).
 */
describe("vocab.json EN — page.tsx literals", () => {
  it("pins the list page heading and empty state", () => {
    expect(en.title).toBe("Vocabulary");
    expect(en.empty).toBe("No vocabulary at this level yet.");
  });

  it("pins the list page's Review link, reused from common.actions.review (kanji/vocab share the identical string, Task 7)", () => {
    expect(common.actions.review).toBe("Review");
  });

  it("pins the list page's word-count subtitle as a real plural (was `{vocab.length} word{vocab.length === 1 ? \"\" : \"s\"}`)", () => {
    expect(en.subtitleCount).toBe(
      "{count, plural, one {{count} word} other {{count} words}}",
    );
  });

  it("pins the detail page's back link", () => {
    expect(en.backToList).toBe("← All vocabulary");
  });

  it("pins the review page's heading", () => {
    expect(en.reviewTitle).toBe("Vocabulary review");
  });
});
