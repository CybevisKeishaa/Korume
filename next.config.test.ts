import { describe, expect, it } from "vitest";
// `tsconfig.json` sets `allowJs: false`, and next.config.mjs is plain JS whose
// only typing is a JSDoc `@type` annotation — so TS cannot produce a declaration
// for it. Suppressed narrowly here, with the shape asserted explicitly below,
// rather than widening anything to `any` (CLAUDE.md §6).
// @ts-expect-error -- untyped .mjs config module, shape asserted via RedirectRule
import nextConfig from "./next.config.mjs";
import { routing } from "@/lib/i18n/routing";

type RedirectRule = { source: string; destination: string; permanent: boolean };

/**
 * Guards the `redirects()` rules in `next.config.mjs` against the defect the
 * whole-branch review of Plan C1 caught: `source: "/:locale/videos"` uses an
 * UNCONSTRAINED path param, so `:locale` happily matches the literal segment
 * `api`. Next applies `redirects()` before the filesystem, so the real endpoint
 * `app/api/videos/route.ts` was answered with `307 -> /api/shadowing`, which
 * then 404s (LocaleLayout calls notFound() for locale="api"). That directly
 * contradicted the LOCKED spec §3.1: "Not renamed: /api/videos/**".
 *
 * Nothing in-repo called the bare endpoint, which is exactly why it went
 * unnoticed through eleven tasks, a per-task review and a full green gate.
 *
 * Why the constraint is asserted HERE rather than only end-to-end: the locale
 * list lives in `lib/i18n/routing.ts`, but `next.config.mjs` cannot import a
 * `.ts` module, so it repeats the alternation as a literal. That duplication is
 * the thing that can silently drift — add "ja" to routing.ts and the redirects
 * quietly stop working for it. This test is what makes the two agree.
 * The end-to-end behaviour (`/api/videos` is not redirected at all) is asserted
 * in tests/e2e/route-rename-redirects.spec.ts, over real HTTP.
 */
describe("next.config.mjs redirects()", () => {
  const rules: Promise<RedirectRule[]> = (
    nextConfig as { redirects: () => Promise<RedirectRule[]> }
  ).redirects();

  /** Pulls "vi|en" out of "/:locale(vi|en)/videos" -> ["vi","en"]. */
  function localeAlternation(source: string): string[] | null {
    const group = /^\/:locale\(([^)]+)\)\//.exec(source)?.[1];
    return group ? group.split("|") : null;
  }

  it("still ships exactly the three rules spec §3.1.1 defines", async () => {
    const sources = (await rules).map((r) => r.source);
    expect(sources).toHaveLength(3);
    expect(sources.map((s) => s.replace(/\(.*?\)/, ""))).toEqual([
      "/:locale/videos",
      "/:locale/videos/:id/shadowing",
      "/:locale/videos/:id/dictation",
    ]);
  });

  it("constrains :locale on EVERY rule, so no rule can match /api/...", async () => {
    for (const rule of await rules) {
      const locales = localeAlternation(rule.source);
      expect(
        locales,
        `${rule.source} leaves :locale unconstrained — it will swallow /api/videos`,
      ).not.toBeNull();
      // The whole point: "api" must not be an accepted locale segment.
      expect(locales).not.toContain("api");
    }
  });

  it("constrains :locale to exactly the locales routing.ts declares", async () => {
    // Compared as a SET, not as a string: reordering the alternation is
    // harmless, whereas a MISSING or EXTRA locale is the real defect.
    for (const rule of await rules) {
      expect([...(localeAlternation(rule.source) ?? [])].sort()).toEqual(
        [...routing.locales].sort(),
      );
    }
  });

  it("keeps every rule TEMPORARY (307), never permanent", async () => {
    // A 308 is cached hard by browsers; these routes move again in Plan D.
    for (const rule of await rules) expect(rule.permanent).toBe(false);
  });
});
