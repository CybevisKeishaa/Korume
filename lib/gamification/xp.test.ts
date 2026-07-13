import { describe, expect, it } from "vitest";
import { xpForOutcome, XP_TABLE } from "./xp";
import type { LearningOutcomeSource } from "./types";

describe("xpForOutcome — fixed table", () => {
  it("awards the documented flat amounts for non-JLPT sources", () => {
    expect(xpForOutcome("srs_review")).toBe(5);
    expect(xpForOutcome("mining_review")).toBe(5);
    expect(xpForOutcome("dictation")).toBe(10);
    expect(xpForOutcome("shadowing")).toBe(15);
    expect(xpForOutcome("reading_submit")).toBe(20);
    expect(xpForOutcome("conversation")).toBe(25);
  });

  it("awards 30 for a JLPT section submit and 50 for a full mock", () => {
    expect(xpForOutcome("jlpt_submit", { mode: "section" })).toBe(30);
    expect(xpForOutcome("jlpt_submit", { mode: "full" })).toBe(50);
  });

  it("has a table entry for every LearningOutcomeSource", () => {
    const sources: LearningOutcomeSource[] = [
      "srs_review",
      "dictation",
      "shadowing",
      "mining_review",
      "jlpt_submit",
      "reading_submit",
      "conversation",
    ];
    for (const source of sources) {
      if (source === "jlpt_submit") {
        expect(xpForOutcome(source, { mode: "section" })).toBeGreaterThan(0);
      } else {
        expect(xpForOutcome(source)).toBeGreaterThan(0);
      }
    }
  });

  it("exposes the raw table for introspection", () => {
    expect(XP_TABLE.srs_review).toBe(5);
    expect(XP_TABLE.jlpt_submit.section).toBe(30);
    expect(XP_TABLE.jlpt_submit.full).toBe(50);
  });
});
