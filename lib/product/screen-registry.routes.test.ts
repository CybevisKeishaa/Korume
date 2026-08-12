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
