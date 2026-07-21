import { describe, expect, it } from "vitest";
import en from "./grammar.json";

/**
 * Characterization test for the grammar list page's strings
 * (`app/[locale]/(app)/grammar/page.tsx`), an async Server Component with no
 * RTL unit test (it calls `getGrammarList`, which needs a running Supabase).
 * Mirrors `messages/en/vocab.pin.test.ts`'s shape (Task 8). Binding pattern 1
 * still requires every extracted string to be pinned, so this test does that
 * directly against the catalog: the SUBJECT under test is
 * `messages/en/grammar.json`, but every expected value below is a literal
 * copied verbatim from the pre-extraction source of `grammar/page.tsx` on
 * `layer-9a-string-extraction` before Task 9 (never derived from the catalog
 * itself — binding pattern 2).
 */
describe("grammar.json EN — page.tsx literals", () => {
  it("pins the list page heading and empty state", () => {
    expect(en.title).toBe("Grammar");
    expect(en.empty).toBe("No grammar at this level yet.");
  });

  it("pins the list page's point-count subtitle as a real plural (was `{grammar.length} point{grammar.length === 1 ? \"\" : \"s\"}`)", () => {
    expect(en.subtitleCount).toBe(
      "{count, plural, one {{count} point} other {{count} points}}",
    );
  });
});
