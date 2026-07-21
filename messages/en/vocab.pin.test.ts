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
 *
 * `errors.*` (added 2026-07-21, closing a hole found reviewing Task 10):
 * this block had no `toBe` pin here — only `vocab-examples-panel.test.tsx`'s
 * `toHaveTextContent(...)` calls touched it, and `toHaveTextContent` given a
 * string is a CONTAINMENT match, not equality, so those assertions stay
 * green even if the catalog value is mutated by appending or prepending
 * text. The five pins below are literal `toBe` checks against the values
 * currently in `messages/en/vocab.json` (frozen English, spec D3/D6) —
 * additive to an already-committed task's test file, which is fine.
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

  it("pins the AI content-labeling surface (CLAUDE.md compliance — the '(AI)' disclosure and the row label)", () => {
    expect(en.generateExamples).toBe("Generate example sentences (AI)");
    expect(en.aiGenerated).toBe("AI-generated");
  });

  it("pins the examples panel's heading, empty state and pending label", () => {
    expect(en.examplesHeading).toBe("Example sentences");
    expect(en.noExamples).toBe("No example sentences yet.");
    expect(en.generating).toBe("Generating…");
  });

  // Each `errors.*` pin gets its own `it()` — not grouped into one, so a
  // single mutated value fails only its own assertion rather than the first
  // failure short-circuiting the rest into a false "not yet checked" silence.

  it("pins errors.unavailable (POST /api/vocab/[id]/examples 503)", () => {
    expect(en.errors.unavailable).toBe(
      "AI example generation isn't set up yet for this deployment.",
    );
  });

  it("pins errors.rateLimited (POST /api/vocab/[id]/examples 429 with seconds)", () => {
    expect(en.errors.rateLimited).toBe(
      "Too many example requests — try again in {seconds}s.",
    );
  });

  it("pins errors.rateLimitedGeneric (POST /api/vocab/[id]/examples 429 without seconds)", () => {
    expect(en.errors.rateLimitedGeneric).toBe(
      "Too many example requests — please wait a moment and try again.",
    );
  });

  it("pins errors.generic (POST /api/vocab/[id]/examples other non-2xx)", () => {
    expect(en.errors.generic).toBe("Could not generate examples right now.");
  });

  it("pins errors.network (POST /api/vocab/[id]/examples request throws)", () => {
    expect(en.errors.network).toBe(
      "Network error — check your connection and try again.",
    );
  });
});
