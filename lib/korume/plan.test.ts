import { describe, expect, it } from "vitest";
import { fallbackPlan, planSchema, validatePlan, type PlanStep } from "./plan";

const anchor = { hasAnchor: true };
const free = { hasAnchor: false };

describe("validatePlan (Review Focus 4)", () => {
  it("keeps at most four distinct steps in the planner's order", () => {
    const steps: PlanStep[] = [
      { tool: "dictionary_lookup", term: "は" }, { tool: "dictionary_lookup", term: " は " },
      { tool: "dictionary_lookup", term: "ｈａ" }, { tool: "line_analysis" }, { tool: "memory_lookup", topic: "particles" },
      { tool: "learner_exposure", term: "は" }, { tool: "knowledge_lookup", section: "grammar_breakdown" },
    ];
    expect(validatePlan({ steps }, anchor)).toEqual([
      { tool: "dictionary_lookup", term: "は" },
      { tool: "dictionary_lookup", term: "ha" },
      { tool: "line_analysis" },
      { tool: "memory_lookup", topic: "particles" },
    ]);
  });

  it("drops anchor-only tools on free chat", () => {
    expect(validatePlan({ steps: [{ tool: "line_analysis" }, { tool: "knowledge_lookup", section: "lite" }] }, free)).toEqual([]);
  });

  it("rejects terms with no Japanese or Latin letter, and over-long ones", () => {
    expect(validatePlan({ steps: [
      { tool: "dictionary_lookup", term: "<>" }, { tool: "dictionary_lookup", term: "123" },
      { tool: "dictionary_lookup", term: "" }, { tool: "dictionary_lookup", term: "あ".repeat(33) },
      { tool: "memory_lookup", topic: "x".repeat(65) },
    ] }, free)).toEqual([]);
    expect(validatePlan({ steps: [{ tool: "dictionary_lookup", term: "<script>" }] }, free)).toEqual([{ tool: "dictionary_lookup", term: "<script>" }]);
  });
});

describe("planSchema", () => {
  it("refuses an unknown tool, an unknown section and an over-long plan at parse time", () => {
    expect(planSchema.safeParse({ steps: [{ tool: "write_memory", topic: "x" }] }).success).toBe(false);
    expect(planSchema.safeParse({ steps: [{ tool: "knowledge_lookup", section: "phrase_analysis" }] }).success).toBe(false);
    expect(planSchema.safeParse({ steps: Array.from({ length: 9 }, () => ({ tool: "line_analysis" })) }).success).toBe(false);
    expect(planSchema.safeParse({ steps: [{ tool: "line_analysis" }] }).success).toBe(true);
  });
});

describe("fallbackPlan", () => {
  it("falls back to the anchor's analysis, or to nothing", () => {
    expect(fallbackPlan(anchor)).toEqual([{ tool: "line_analysis" }]);
    expect(fallbackPlan(free)).toEqual([]);
  });
});
