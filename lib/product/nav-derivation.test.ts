import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/components/layout/app-nav";
import { NAV_BASELINE } from "./nav-baseline.fixture";
import { deriveNavGroups } from "./nav-derivation";
import { SCREEN_REGISTRY } from "./screen-registry";

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
