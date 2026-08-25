import { describe, expect, it } from "vitest";
import { SCREEN_REGISTRY } from "./screen-registry";

describe("screen registry invariants", () => {
  it("T3: figmaNodeId is present iff the entry is repo-only or spec-only", () => {
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only" || entry.kind === "spec-only") {
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

  it("T12: spec-only is the empty cell — no frame, route, chrome, variant, repo-only reason, stamp, or nav", () => {
    const specOnly = SCREEN_REGISTRY.filter((e) => e.kind === "spec-only");
    // Vacuous by construction in Stage 1: zero spec-only rows exist yet
    // (spec §5.6). Proven instead by mutation-check (see the Stage 1 plan) —
    // CLAUDE.md §7, spec §8.2. Stage 2 adds:
    //   expect(specOnly.length).toBeGreaterThan(0);
    // once real rows exist — not before, since zero is the correct count now.
    for (const entry of specOnly) {
      expect(entry.figmaNodeId, entry.screenId).toBeNull();
      expect(entry.route, entry.screenId).toBeNull();
      expect(entry.chrome, entry.screenId).toBeNull();
      expect(entry.impl, entry.screenId).toBe("none");
      expect(entry.variantOf, entry.screenId).toBeNull();
      expect(entry.repoOnlyReason, entry.screenId).toBeNull();
      expect(entry.figmaCheckedAt, entry.screenId).toBeNull();
      expect(entry.navGroup, entry.screenId).toBeNull();
      expect(entry.navOrder, entry.screenId).toBeNull();
    }
  });

  it("T13: specRef is present iff spec-only, and matches an allowed citation shape", () => {
    // Only two sources are valid scan targets for Phase 3 (spec §6.1): the
    // product spec and the decision register. A loose `/\.md §/` pattern is
    // deliberately rejected — it would admit capability-map.md, a
    // Figma-derived source this phase excludes on purpose.
    const SPEC_REF_PATTERN =
      /^(japanese-learning-app-spec\.md §\d+(\.\d+)*|decision-register\.md A\d+)$/;
    // Vacuous by construction in Stage 1: zero spec-only rows exist yet
    // (spec §5.6), so this loop runs zero iterations today. Proven instead
    // by mutation-check (see the Stage 1 plan) — CLAUDE.md §7, spec §8.2.
    // Stage 2 adds a non-vacuity assertion once real rows exist.
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "spec-only") {
        expect(entry.specRef, entry.screenId).not.toBeNull();
        expect(entry.specRef as string, entry.screenId).toMatch(SPEC_REF_PATTERN);
      } else {
        expect(entry.specRef, entry.screenId).toBeNull();
      }
    }
  });

  it("R12: every entry carries exactly the thirteen allowed fields", () => {
    // The concrete guard on R1. If someone adds `copy`, `layout`, `colors` or
    // `dataNeeds`, the registry has started becoming a second Figma. It is
    // also G3: `ruledBy` / `ruledAt` cannot be added without failing here.
    // Checked in BOTH directions — the older form only rejected unknown keys,
    // so an entry missing a field passed.
    const ALLOWED = [
      "screenId", "name", "kind", "variantOf", "figmaNodeId", "repoOnlyReason",
      "figmaCheckedAt", "route", "chrome", "impl", "navGroup", "navOrder",
      "specRef",
    ];
    expect(ALLOWED).toHaveLength(13);
    expect(SCREEN_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of SCREEN_REGISTRY) {
      expect(Object.keys(entry).sort(), entry.screenId).toEqual([...ALLOWED].sort());
    }
  });

  it("G2: no out-of-design-scope entry can carry a figmaCheckedAt stamp", () => {
    // Phase 2a backfilled the stamp from CITATIONS, never from membership in
    // `repo-only`. Every entry the Phase 0 pass demonstrably examined carries
    // that pass's own date, 2026-08-12.
    //
    // THE PERMANENT INVARIANT — a SUBSET relation, and it is asserted first.
    // `out-of-design-scope` means Figma will never cover the entry, so
    // "compared against Figma at time X" (R7) is not a claim that can honestly
    // be made about it: it can never carry a stamp, in any future state of the
    // registry. A null `figmaCheckedAt` therefore means one of two true things
    // — never compared, or never comparable — and never "we forgot".
    //
    // ⚠️ This read `expect(unstamped).toEqual(outOfScopeIds)` until 2026-08-14,
    // and set EQUALITY is a stronger claim than either spec makes. It declares
    // the survey backlog permanently empty by decree: the moment anyone
    // registers a genuinely un-surveyed route — which Phase 3 does BY DESIGN —
    // the suite goes red, and the cheapest green is to write a `2026-08-12`
    // stamp for a Figma pass that never happened. That is the exact dishonesty
    // the "a citation licenses the stamp" rule exists to prevent, so the
    // equality is gone and the subset stands.
    //
    // The set is DERIVED from `repoOnlyReason === "out-of-design-scope"`, never
    // hardcoded as a literal id list (fix round 1 on Task 4: a hardcoded list
    // is a magic number that silently stops protecting this invariant the
    // moment the admin route count changes; deriving it means the test keeps
    // checking the actual relationship, not today's headcount).
    const outOfScope = SCREEN_REGISTRY.filter(
      (e) => e.repoOnlyReason === "out-of-design-scope",
    );
    // Non-vacuity: without this, an empty derived set makes the loop below
    // unconditionally true (CLAUDE.md §7).
    expect(outOfScope.length).toBeGreaterThan(0);
    for (const entry of outOfScope) {
      expect(entry.figmaCheckedAt, entry.screenId).toBeNull();
    }

    // ---- TODAY'S STATE. Not invariants. -------------------------------------
    // These two pins record what the registry happens to hold on 2026-08-20 so
    // that a change to either is conscious rather than silent. They are
    // EXPECTED to move: the id list when the admin surface changes, and the
    // per-date counts whenever a genuinely re-checked entry is stamped with a
    // new date (Task 9/10 did that: `settings` was re-compared alongside its
    // new child `data-privacy`, and `delete-data` was stamped the same day) or
    // a stamped entry is deleted, which has already happened once: A16's
    // `jlpt-test` deletion landed in 2b at `888ce75` and took the count below
    // from 74 to 73.
    // Updating a pin to match a measured registry is normal. Stamping an entry
    // to make a pin green is the failure this whole test exists to catch.
    expect(outOfScope.map((e) => e.screenId).sort()).toEqual([
      "admin",
      "admin-content",
      "admin-content-type",
      "admin-style-guide",
      "admin-videos",
    ]);

    const stamped = SCREEN_REGISTRY.filter((e) => e.figmaCheckedAt !== null);
    expect(stamped).toHaveLength(75);
    const stampedByDate = new Map<string, number>();
    for (const entry of stamped) {
      const date = entry.figmaCheckedAt as string;
      stampedByDate.set(date, (stampedByDate.get(date) ?? 0) + 1);
    }
    // Non-vacuity: `stamped`'s length (asserted above) already proves this
    // map is non-empty; this pins the exact per-date breakdown too, so a
    // change to either the total or the split between the two dates is
    // conscious rather than silent.
    expect(Object.fromEntries(stampedByDate)).toEqual({
      "2026-08-12": 72,
      "2026-08-20": 3,
    });
  });
});
