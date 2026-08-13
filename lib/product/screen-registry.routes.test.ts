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

  it("T2b: every nav destination resolves to a real page.tsx", () => {
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
