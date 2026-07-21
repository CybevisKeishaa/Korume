import { describe, expect, it } from "vitest";
import en from "./dashboard.json";
import common from "./common.json";

/**
 * Characterization test for `app/[locale]/(app)/dashboard/page.tsx`'s strings.
 *
 * page.tsx is an async Server Component with no RTL unit test (dashboard requires
 * an authenticated session + running Supabase — see the e2e specs, which only
 * assert on the `/en/dashboard` URL, never its content). Binding pattern 1 still
 * requires every extracted string to be pinned, so this test does that directly
 * against the catalog: the SUBJECT under test is `messages/en/dashboard.json`,
 * but every expected value below is a literal copied verbatim from
 * `git show 269b97f:app/[locale]/(app)/dashboard/page.tsx` (the pre-extraction
 * source), never derived from the catalog itself (binding pattern 2).
 *
 * `recommendationsHeading`/`recommendationsLoading` used to live here, but
 * Task 10 found `app/[locale]/(app)/videos/page.tsx` hardcoding the identical
 * two strings for its own recommendation rail. A string needed by two or more
 * modules is promoted to `common` (CLAUDE.md P4 / Task 7's binding rule) — so
 * both moved to `common.recommendations.heading`/`.loading`, and this pin
 * moved with them rather than vanishing.
 */
describe("dashboard.json EN — page.tsx literals", () => {
  it("pins the page heading and subtitle", () => {
    expect(en.title).toBe("Dashboard");
    expect(en.subtitle).toBe("Pick a module to start studying.");
  });

  it("pins the progress section's aria-label", () => {
    expect(en.a11y.progress).toBe("Your progress");
  });

  it("pins the badges section heading", () => {
    expect(en.badges.heading).toBe("Badges");
  });

  it("pins the recommendations section heading and loading fallback, promoted to common.recommendations (shared with /videos)", () => {
    expect(common.recommendations.heading).toBe("Recommended for you");
    expect(common.recommendations.loading).toBe("Finding videos at your level…");
  });

  it("pins the modules section heading and all three module cards", () => {
    expect(en.modules.heading).toBe("Modules");
    expect(en.modules.kanjiTitle).toBe("Kanji");
    expect(en.modules.kanjiDesc).toBe("Stroke order, readings, SRS.");
    expect(en.modules.vocabTitle).toBe("Vocabulary");
    expect(en.modules.vocabDesc).toBe("Words by level + flashcard review.");
    expect(en.modules.grammarTitle).toBe("Grammar");
    expect(en.modules.grammarDesc).toBe("Patterns with examples.");
  });
});
