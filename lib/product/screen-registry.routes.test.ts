import { describe, expect, it } from "vitest";
import { listPageRoutes } from "./route-resolver";
import { SCREEN_REGISTRY } from "./screen-registry";

const derived = listPageRoutes(process.cwd());
const derivedRoutes = new Set(derived.map((r) => r.route));
const byRoute = new Map(
  SCREEN_REGISTRY.filter((e) => e.route !== null).map((e) => [e.route as string, e]),
);

describe("registry ↔ repo routes", () => {
  it("T1: every page.tsx in the repo has exactly one registry entry", () => {
    const orphans = [...derivedRoutes].filter((route) => !byRoute.has(route));
    expect(orphans).toEqual([]);
  });

  it("T2: every entry claiming built/placeholder resolves to a real page.tsx", () => {
    // `impl: 'built'` is never taken on trust (spec §3.4).
    const lying = SCREEN_REGISTRY.filter(
      (e) => e.route !== null && e.impl !== "none" && !derivedRoutes.has(e.route),
    ).map((e) => e.screenId);
    expect(lying).toEqual([]);
  });

  /**
   * T2 runs one way only: it catches a registry that OVER-claims (`built`
   * with no page behind it) and exempts `impl: "none"` entirely. So the
   * opposite lie was free — a route with a real, shipping page could be
   * recorded as rendering nothing and every test stayed green. Found by
   * mutation-checking Task 9: flipping `/settings` to `"none"` after building
   * it reddened nothing, and `upcoming-routes.test.tsx` no longer lists it.
   *
   * That direction matters because this registry is how the Figma port
   * backlog is counted. Under-claiming does not break a screen; it makes the
   * project report itself as further behind than it is, and the correction
   * arrives as a surprise rather than as progress.
   *
   * Measured before being written: 35 entries are `"none"` today and NONE of
   * them has a page, so this starts green with no exemption list to maintain.
   * A screen that genuinely ships a page while rendering nothing real does
   * not exist — that is what `"placeholder"` is for.
   */
  it("T12: no entry claims 'none' while a real page.tsx sits at its route", () => {
    const understating = SCREEN_REGISTRY.filter(
      (e) => e.route !== null && e.impl === "none" && derivedRoutes.has(e.route),
    ).map((e) => e.screenId);
    expect(understating).toEqual([]);
  });

  it("T11: every nav destination resolves to a real page.tsx", () => {
    // T11, not T2b: the spec's §4.1 table already uses T2b for the resolver
    // unit test, and this assertion took the same id by accident. Renamed
    // 2026-08-13; semantics unchanged.
    // NOT covered by T1, which runs the other way: T1 asks "does every
    // page.tsx have an entry?", this asks "does every sidebar row lead
    // somewhere?". The spec's claim that T1 "subsumes and generalises" the
    // old href-resolves guard in app-nav.test.tsx was wrong (corrected in
    // that spec, §4.1) — deleting the guard on that basis left a nav entry
    // free to point at a routeless screen with every test green. Phase 1b
    // adds designed-before-built screens, so this WILL be exercised.
    const dead = SCREEN_REGISTRY.filter(
      (e) => e.navGroup !== null && (e.route === null || !derivedRoutes.has(e.route)),
    ).map((e) => e.screenId);
    expect(dead).toEqual([]);
  });

  it("T8: chrome matches the route groups actually dropped from the file path", () => {
    // Catches a screen moved between chrome contracts. Entries with no page
    // are exempt — they have nothing to disagree with.
    const mismatched = derived
      .filter((r) => {
        const entry = byRoute.get(r.route);
        return entry !== undefined && entry.chrome !== r.chrome;
      })
      .map((r) => r.route);
    expect(mismatched).toEqual([]);
  });
});
