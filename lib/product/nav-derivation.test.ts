import { describe, expect, it } from "vitest";
import { NAV_BASELINE } from "./nav-baseline.fixture";
import { deriveNavGroups } from "./nav-derivation";
import { NAV_GROUPS } from "./nav-groups";
import { SCREEN_REGISTRY } from "./screen-registry";
import type { ScreenEntry } from "./screen-registry-types";

describe("nav baseline fixture", () => {
  it("is a faithful copy of the literal shipping today", () => {
    expect(NAV_BASELINE).toEqual(NAV_GROUPS);
  });
});

describe("T6: derived NAV_GROUPS reproduces today's literal exactly", () => {
  it("deep-equals the frozen baseline (R8, zero visual diff)", () => {
    expect(deriveNavGroups(SCREEN_REGISTRY)).toEqual(NAV_BASELINE);
  });

  it("preserves group order, not just membership", () => {
    expect(deriveNavGroups(SCREEN_REGISTRY).map((g) => g.key)).toEqual(
      NAV_BASELINE.map((g) => g.key),
    );
  });

  it("preserves item order within every group", () => {
    const derived = deriveNavGroups(SCREEN_REGISTRY);
    for (const [index, group] of NAV_BASELINE.entries()) {
      const derivedGroup = derived[index];
      expect(derivedGroup, group.key).toBeDefined();
      expect(derivedGroup?.items.map((i) => i.key), group.key).toEqual(
        group.items.map((i) => i.key),
      );
    }
  });
});

describe("deriveNavGroups rejects a nav entry with nowhere to go", () => {
  // Final review FIX 1. The old implementation filtered these out silently,
  // so the only symptom was a sidebar row that stopped existing.
  const routeless: ScreenEntry = {
    screenId: "companion",
    name: "Companion home",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "156:1310",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: "learn",
    navOrder: 9,
  };

  it("throws instead of dropping the row", () => {
    expect(() => deriveNavGroups([...SCREEN_REGISTRY, routeless])).toThrow(
      /companion/,
    );
  });

  it("names the failure as a missing route, not a generic error", () => {
    expect(() => deriveNavGroups([routeless])).toThrow(/no route/);
  });
});
