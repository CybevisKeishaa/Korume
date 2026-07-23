import { describe, expect, it } from "vitest";
import { MASTERY_ATTEMPTS, TARGET_SCORE, qualifiesAsLineMastered } from "./mastery";

describe("qualifiesAsLineMastered (spec D5 — deterministic, honest)", () => {
  it("qualifies: ≥3 attempts, current ≥80, at least one earlier attempt <80", () => {
    expect(qualifiesAsLineMastered([60, 75], 85)).toBe(true);
  });

  it("does not qualify when the current attempt misses the target", () => {
    expect(qualifiesAsLineMastered([60, 75], 79)).toBe(false);
  });

  it("does not qualify without enough attempts", () => {
    expect(qualifiesAsLineMastered([60], 85)).toBe(false); // 2 total < MASTERY_ATTEMPTS
  });

  it("first-try success is first_shadow's territory, never mastery-through-struggle", () => {
    expect(qualifiesAsLineMastered([90, 85], 88)).toBe(false); // no earlier struggle
  });

  it("constants are the spec's (hidden tuning, not UI)", () => {
    expect(TARGET_SCORE).toBe(80);
    expect(MASTERY_ATTEMPTS).toBe(3);
  });
});
