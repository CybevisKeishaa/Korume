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
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only") {
        expect(entry.repoOnlyReason, entry.screenId).not.toBeNull();
      } else {
        expect(entry.repoOnlyReason, entry.screenId).toBeNull();
      }
    }
  });

  it("T10: out-of-design-scope is restricted to admin chrome", () => {
    for (const entry of SCREEN_REGISTRY) {
      if (entry.repoOnlyReason === "out-of-design-scope") {
        expect(entry.chrome, entry.screenId).toBe("admin");
      }
    }
  });

  it("R12: no entry carries an appearance or behaviour field", () => {
    // The concrete guard on R1. If someone adds `copy`, `layout`, `colors` or
    // `dataNeeds`, the registry has started becoming a second Figma.
    const ALLOWED = new Set([
      "screenId", "name", "kind", "variantOf", "figmaNodeId", "repoOnlyReason",
      "figmaCheckedAt", "route", "chrome", "impl", "navGroup", "navOrder",
    ]);
    for (const entry of SCREEN_REGISTRY) {
      for (const key of Object.keys(entry)) {
        expect(ALLOWED, `${entry.screenId}.${key}`).toContain(key);
      }
    }
  });
});
