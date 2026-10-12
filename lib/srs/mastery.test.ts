import { describe, expect, it } from "vitest";
import { masteryTransition } from "./mastery";

const now = new Date("2026-10-08T10:00:00.000Z");

describe("masteryTransition", () => {
  it("stamps the first crossing with now", () => {
    expect(masteryTransition({ wasMastered: false, isMastered: true, existingMasteredAt: null, now })).toBe(now.toISOString());
  });
  it("keeps an existing timestamp even after a lapse (never reset)", () => {
    const at = "2026-09-01T00:00:00.000Z";
    expect(masteryTransition({ wasMastered: true, isMastered: false, existingMasteredAt: at, now })).toBe(at);
    expect(masteryTransition({ wasMastered: false, isMastered: true, existingMasteredAt: at, now })).toBe(at);
  });
  it("invents no date for a row already mastered before instrumentation", () => {
    expect(masteryTransition({ wasMastered: true, isMastered: true, existingMasteredAt: null, now })).toBeNull();
  });
  it("writes nothing while not mastered", () => {
    expect(masteryTransition({ wasMastered: false, isMastered: false, existingMasteredAt: null, now })).toBeNull();
  });
});
