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

  it("a score of exactly TARGET_SCORE qualifies (the boundary is inclusive)", () => {
    expect(qualifiesAsLineMastered([60, 75], 80)).toBe(true);
  });

  it("an earlier attempt of exactly TARGET_SCORE is not a struggle", () => {
    expect(qualifiesAsLineMastered([80, 85], 90)).toBe(false);
  });

  it("never re-fires on a dip-then-recover once the line has already been at target (spec §4.3 'trend up', user decision 2026-07-29)", () => {
    // History [90, 60] then 85: without the "never been at target" guard this
    // would have qualified — a line the learner already nailed at 90 would
    // fire line_mastered again on a later, lesser recovery. It is a one-time
    // milestone per line, not a repeatable recovery event.
    expect(qualifiesAsLineMastered([90, 60], 85)).toBe(false);
  });

  it("still qualifies on a genuine first-time climb even when scores are unsorted", () => {
    expect(qualifiesAsLineMastered([60, 90], 85)).toBe(false); // one earlier score already at target
    expect(qualifiesAsLineMastered([70, 65], 82)).toBe(true); // never at target before, now is
  });

  it("constants are the spec's (hidden tuning, not UI)", () => {
    expect(TARGET_SCORE).toBe(80);
    expect(MASTERY_ATTEMPTS).toBe(3);
  });
});
