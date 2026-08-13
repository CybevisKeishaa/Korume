import { describe, expect, it } from "vitest";
import { SCREEN_REGISTRY } from "./screen-registry";

describe("screen registry invariants", () => {
  it("T3: figmaNodeId is present iff the entry is not repo-only", () => {
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only") {
        expect(entry.figmaNodeId, entry.screenId).toBeNull();
      } else {
        expect(entry.figmaNodeId, entry.screenId).not.toBeNull();
      }
    }
  });

  it("T4: variantOf is present iff state-variant, and names a real screen", () => {
    const screens = new Set(
      SCREEN_REGISTRY.filter((e) => e.kind === "screen").map((e) => e.screenId),
    );
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "state-variant") {
        expect(entry.variantOf, entry.screenId).not.toBeNull();
        expect(screens, entry.screenId).toContain(entry.variantOf);
      } else {
        expect(entry.variantOf, entry.screenId).toBeNull();
      }
    }
  });

  it("T5: screenId is unique, and route is unique among non-null routes", () => {
    const ids = SCREEN_REGISTRY.map((e) => e.screenId);
    expect(new Set(ids).size).toBe(ids.length);

    const routes = SCREEN_REGISTRY.map((e) => e.route).filter(
      (r): r is string => r !== null,
    );
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("T7: a nav entry has a navOrder, unique within its group", () => {
    const byGroup = new Map<string, number[]>();
    for (const entry of SCREEN_REGISTRY) {
      if (entry.navGroup === null) {
        expect(entry.navOrder, entry.screenId).toBeNull();
        continue;
      }
      expect(entry.navOrder, entry.screenId).not.toBeNull();
      const orders = byGroup.get(entry.navGroup) ?? [];
      orders.push(entry.navOrder as number);
      byGroup.set(entry.navGroup, orders);
    }
    for (const [group, orders] of byGroup) {
      expect(new Set(orders).size, group).toBe(orders.length);
    }
  });

  it("T9: repoOnlyReason is present iff the entry is repo-only", () => {
    const repoOnly = SCREEN_REGISTRY.filter((e) => e.kind === "repo-only");
    // Non-vacuity: without this, an empty filter makes every assertion below
    // unconditionally true (CLAUDE.md §7).
    expect(repoOnly.length).toBeGreaterThan(0);
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only") {
        expect(entry.repoOnlyReason, entry.screenId).not.toBeNull();
      } else {
        expect(entry.repoOnlyReason, entry.screenId).toBeNull();
      }
    }
  });

  it("T10: out-of-design-scope is restricted to admin chrome", () => {
    const outOfScope = SCREEN_REGISTRY.filter(
      (e) => e.repoOnlyReason === "out-of-design-scope",
    );
    expect(outOfScope.length).toBeGreaterThan(0);
    for (const entry of outOfScope) {
      expect(entry.chrome, entry.screenId).toBe("admin");
    }
  });

  it("R12: every entry carries exactly the twelve allowed fields", () => {
    // The concrete guard on R1. If someone adds `copy`, `layout`, `colors` or
    // `dataNeeds`, the registry has started becoming a second Figma. It is
    // also G3: `ruledBy` / `ruledAt` cannot be added without failing here.
    // Checked in BOTH directions — the older form only rejected unknown keys,
    // so an entry missing a field passed.
    const ALLOWED = [
      "screenId", "name", "kind", "variantOf", "figmaNodeId", "repoOnlyReason",
      "figmaCheckedAt", "route", "chrome", "impl", "navGroup", "navOrder",
    ];
    expect(ALLOWED).toHaveLength(12);
    expect(SCREEN_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of SCREEN_REGISTRY) {
      expect(Object.keys(entry).sort(), entry.screenId).toEqual([...ALLOWED].sort());
    }
  });

  it("G2: figmaCheckedAt is null on exactly the out-of-design-scope entries", () => {
    // Phase 2a backfilled the stamp from CITATIONS, never from membership in
    // `repo-only`. Every entry the Phase 0 pass demonstrably examined carries
    // that pass's own date, 2026-08-12.
    //
    // The /admin/* routes deliberately keep `null`: `out-of-design-scope`
    // means Figma will never cover them, so "compared against Figma at time X"
    // (R7) is not a claim that can honestly be made about them. A null here
    // therefore means one of two true things — never compared, or never
    // comparable — and never "we forgot".
    //
    // The exception set is DERIVED from `repoOnlyReason === "out-of-design-scope"`,
    // never hardcoded as a literal id list (fix round 1 on Task 4: a hardcoded
    // list is a magic number that silently stops protecting this invariant the
    // moment the admin route count changes; deriving it means the test keeps
    // checking the actual relationship, not today's headcount). Asserted as a
    // SET, not a count: a blanket stamp that happened to hit the right total
    // would pass a count assertion and fail this one.
    const outOfScopeIds = SCREEN_REGISTRY.filter(
      (e) => e.repoOnlyReason === "out-of-design-scope",
    )
      .map((e) => e.screenId)
      .sort();
    // Non-vacuity: without this, an empty derived set makes the equality below
    // unconditionally true (CLAUDE.md §7).
    expect(outOfScopeIds.length).toBeGreaterThan(0);

    const unstamped = SCREEN_REGISTRY.filter((e) => e.figmaCheckedAt === null)
      .map((e) => e.screenId)
      .sort();
    expect(unstamped).toEqual(outOfScopeIds);

    // Today's state, pinned on top of the semantic check above: a later
    // change to the admin route count must force a conscious update here,
    // not pass silently because the set-equality check above already covers
    // "whatever the exception set is."
    expect(outOfScopeIds).toEqual([
      "admin",
      "admin-content",
      "admin-content-type",
      "admin-style-guide",
      "admin-videos",
    ]);

    const stamped = SCREEN_REGISTRY.filter((e) => e.figmaCheckedAt !== null);
    expect(stamped).toHaveLength(74);
    for (const entry of stamped) {
      expect(entry.figmaCheckedAt, entry.screenId).toBe("2026-08-12");
    }
  });
});
