import { describe, expect, it } from "vitest";
import en from "./videos.json";

/**
 * Characterization test for `messages/en/videos.json`'s literals.
 *
 * Binding pattern 1 requires every extracted string to be pinned; the pin
 * itself is a literal `toBe` assertion against the catalog, in this file —
 * NOT an RTL `toHaveTextContent` assertion in a component test. Rendered
 * text is proof of WIRING (the right string reached the right element), not
 * proof of copy: `toHaveTextContent` given a string is a CONTAINMENT match,
 * not equality, so `messages/en/videos.json`'s `errors.*` block used to be
 * "pinned" only by six `toHaveTextContent("...")` calls in
 * `video-import-form.test.tsx` — and a code-reviewer mutation test proved
 * those stayed green even when every one of those six values was mutated by
 * appending or prepending text. This file's `errors.*` block below closes
 * that hole with real `toBe` pins; `video-import-form.test.tsx`'s six
 * `toHaveTextContent` assertions still stand, but now only as proof the
 * form actually threads `t()` output into the alert (wiring), not as the
 * source of truth for the copy.
 *
 * Every expected value below is a literal copied verbatim from the
 * pre-extraction source of `videos/page.tsx` / `video-import-form.tsx` on
 * `layer-9a-string-extraction` before Task 10 (never derived from the
 * catalog itself — binding pattern 2).
 *
 * `VideoImportForm`'s and `VideoCard`'s non-error strings (label, button
 * states, `Pending review`) are pinned via their own RTL tests
 * (`components/video/video-import-form.test.tsx`,
 * `components/video/video-card.test.tsx`) using EXACT `getByText`/
 * `getByLabelText`/`getByRole({ name })` matches, which — unlike
 * `toHaveTextContent` — perform equality, not containment, so those remain
 * valid content pins. The shared recommendation rail's heading/loading
 * fallback are pinned against `common.json` in
 * `messages/en/dashboard.pin.test.ts` (Task 10 promoted them there, since
 * both `/dashboard` and `/videos` render the same rail — CLAUDE.md P4).
 */
describe("videos.json EN — literals", () => {
  it("pins the page heading and subtitle", () => {
    expect(en.title).toBe("Lessons");
    expect(en.subtitle).toBe(
      "Shadow and study Japanese YouTube videos. Paste a link to add one.",
    );
  });

  it("pins the 'Your videos' section heading", () => {
    expect(en.yourVideos).toBe("Your videos");
  });

  it("pins the empty state shown when the user has no videos yet", () => {
    expect(en.empty).toBe("No videos yet — paste a YouTube URL above to start.");
  });

  // Each `errors.*` pin gets its own `it()` — not grouped into one, so a
  // single mutated value fails only its own assertion and every other pin
  // still reports its real status, rather than the first failure
  // short-circuiting the rest into a false "not yet checked" silence.

  it("pins errors.invalidUrl (POST /api/videos/import 400)", () => {
    expect(en.errors.invalidUrl).toBe("That doesn't look like a valid YouTube URL.");
  });

  it("pins errors.sessionExpired (POST /api/videos/import 401)", () => {
    expect(en.errors.sessionExpired).toBe("Your session expired — please sign in again.");
  });

  it("pins errors.fetchFailed (POST /api/videos/import 422)", () => {
    expect(en.errors.fetchFailed).toBe(
      "We couldn't fetch details for that video. Double-check the link and try again.",
    );
  });

  it("pins errors.rateLimited (POST /api/videos/import 429 with Retry-After)", () => {
    expect(en.errors.rateLimited).toBe(
      "Too many imports — please wait {seconds}s and try again.",
    );
  });

  it("pins errors.rateLimitedGeneric (POST /api/videos/import 429 without Retry-After)", () => {
    expect(en.errors.rateLimitedGeneric).toBe(
      "Too many imports — please wait a moment and try again.",
    );
  });

  it("pins errors.generic (POST /api/videos/import network failure)", () => {
    expect(en.errors.generic).toBe(
      "Something went wrong importing that video. Please try again.",
    );
  });
});
