import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { routing } from "@/lib/i18n/routing";
import { stripLocale } from "@/lib/i18n/locale-path";
import {
  AUTH_ROUTES,
  PROTECTED_PREFIXES,
  isAuthRoute,
  isProtectedPath,
} from "./route-protection";

describe("route protection", () => {
  // Anchor test independent of the matrix below: the matrix iterates
  // PROTECTED_PREFIXES/AUTH_ROUTES themselves, so silently *dropping* an
  // entry (e.g. deleting "/profile") makes the matrix test one row fewer
  // and all its assertions still pass. Pinning the literal contents here
  // means a removed prefix fails loudly instead of vanishing unnoticed.
  it("pins the exact set and order of PROTECTED_PREFIXES and AUTH_ROUTES", () => {
    expect(PROTECTED_PREFIXES).toEqual([
      "/dashboard",
      "/kanji",
      "/vocab",
      "/grammar",
      "/shadowing",
      "/reading",
      "/conversation",
      "/jlpt",
      "/community",
      "/playlists",
      "/leaderboard",
      "/profile",
      "/journal",
      "/mining",
      "/achievements",
      "/challenges",
      "/review",
      "/roadmap",
      "/sensei",
      "/settings",
      // Phase 1b's two new destinations. Added here as a conscious edit,
      // which is exactly what this pin exists to force.
      "/companion",
      "/pronunciation",
      "/statistics",
      "/weekly-report",
      "/content-manager",
      "/video-curator",
      "/admin",
    ]);
    expect(AUTH_ROUTES).toEqual(["/login", "/register"]);
  });

  it("protects a mis-cased locale prefix (defence in depth, not reliance on next-intl's redirect)", () => {
    expect(isProtectedPath(stripLocale("/VI/dashboard").pathname)).toBe(true);
    expect(isProtectedPath(stripLocale("/En/profile").pathname)).toBe(true);
  });

  it("protects every prefix under every locale", () => {
    for (const locale of routing.locales) {
      for (const prefix of PROTECTED_PREFIXES) {
        const url = `/${locale}${prefix}`;
        expect(
          isProtectedPath(stripLocale(url).pathname),
          `${url} must be protected`,
        ).toBe(true);
      }
    }
  });

  it("protects nested routes under every prefix and locale", () => {
    for (const locale of routing.locales) {
      for (const prefix of PROTECTED_PREFIXES) {
        const url = `/${locale}${prefix}/nested/deep`;
        expect(
          isProtectedPath(stripLocale(url).pathname),
          `${url} must be protected`,
        ).toBe(true);
      }
    }
  });

  it("recognises auth routes under every locale", () => {
    for (const locale of routing.locales) {
      for (const route of AUTH_ROUTES) {
        expect(isAuthRoute(stripLocale(`/${locale}${route}`).pathname)).toBe(true);
      }
    }
  });

  it("leaves public routes unprotected", () => {
    for (const locale of routing.locales) {
      expect(isProtectedPath(stripLocale(`/${locale}`).pathname)).toBe(false);
      expect(isProtectedPath(stripLocale(`/${locale}/login`).pathname)).toBe(false);
    }
  });

  it("does not protect a path that merely starts with a prefix's characters", () => {
    // "/shadowingsomething" must not be swallowed by the "/shadowing" prefix.
    expect(isProtectedPath("/shadowingsomething")).toBe(false);
  });

  /**
   * The guard the whole-branch review of Plan C1 asked for, and the one that
   * would have caught its own defect: Task 6 added eight directories under
   * `(protected)/(app)/` and none of them reached PROTECTED_PREFIXES, so
   * middleware never saw them. Access control still held — `(protected)/layout.tsx`
   * does its own server-side redirect — but `redirectTo` was silently dropped,
   * so a signed-out user opening a shared `/vi/settings` link landed on
   * `/vi/dashboard` after logging in instead of on settings. `/shadowing/explore`
   * kept its `redirectTo` while its eight siblings lost theirs, which is the
   * asymmetry that proves the mechanism.
   *
   * Every other test in this file iterates PROTECTED_PREFIXES, so none of them
   * can notice a route that was never added. This one starts from the
   * FILESYSTEM instead — the set of routes that actually exist — which is why
   * it fails on the next forgotten one rather than on this one only.
   */
  it("covers every page under (protected) — a new protected route cannot skip middleware", () => {
    // Vitest runs from the repo root. Asserted rather than assumed, so this
    // test fails loudly instead of walking nothing if that ever changes.
    const appRoot = path.join(process.cwd(), "app", "[locale]");
    expect(fs.existsSync(appRoot), `expected app/[locale] at ${appRoot}`).toBe(true);

    /** Locale-stripped URL path for a page file, per Next's route-group rule. */
    const routeOf = (abs: string) =>
      "/" +
      path
        .relative(appRoot, path.dirname(abs))
        .split(path.sep)
        .filter((seg) => !/^\(.*\)$/.test(seg)) // route groups are invisible in URLs
        .join("/");

    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === "page.tsx") pages.push(p);
      }
    };
    walk(path.join(appRoot, "(protected)"));

    // Guard the guard: if the walk found nothing, every assertion below would
    // pass vacuously and this test would be worthless.
    expect(pages.length).toBeGreaterThan(20);

    const unprotected = pages.map(routeOf).filter((r) => !isProtectedPath(r));
    expect(
      unprotected,
      `these (protected) routes have no covering PROTECTED_PREFIXES entry, so middleware skips them: ${unprotected.join(", ")}`,
    ).toEqual([]);
  });
});
