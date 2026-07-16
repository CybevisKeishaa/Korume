import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PHASE_THRESHOLDS, relationshipPhaseForXp } from "./phase";

describe("relationshipPhaseForXp", () => {
  it("starts at phase 1 at zero XP", () => {
    expect(relationshipPhaseForXp(0)).toBe(1);
  });

  it("returns each phase at its threshold boundary", () => {
    expect(relationshipPhaseForXp(PHASE_THRESHOLDS[1] - 1)).toBe(1);
    expect(relationshipPhaseForXp(PHASE_THRESHOLDS[1])).toBe(2);
    expect(relationshipPhaseForXp(PHASE_THRESHOLDS[2])).toBe(3);
    expect(relationshipPhaseForXp(PHASE_THRESHOLDS[3])).toBe(4);
  });

  it("never decreases as XP increases (monotonicity, §4.1)", () => {
    fc.assert(
      fc.property(fc.nat({ max: 1_000_000 }), fc.nat({ max: 1_000_000 }), (a, b) => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        return relationshipPhaseForXp(lo) <= relationshipPhaseForXp(hi);
      }),
    );
  });

  it("clamps negative XP to phase 1", () => {
    expect(relationshipPhaseForXp(-5)).toBe(1);
  });
});
