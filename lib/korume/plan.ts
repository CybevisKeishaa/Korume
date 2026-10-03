import { z } from "zod/v4";
import { KNOWLEDGE_SECTIONS, type CascadeSection } from "@/lib/knowledge/types";

export type PlanStep =
  | { tool: "line_analysis" }
  | { tool: "dictionary_lookup"; term: string }
  | { tool: "memory_lookup"; topic: string }
  | { tool: "learner_exposure"; term: string }
  | { tool: "knowledge_lookup"; section: CascadeSection };

export const MAX_PLAN_STEPS = 4;
/** Parse-time ceiling: a longer list is a malformed plan, not something to trim. */
const MAX_PARSED_STEPS = 8;

/** The allowlist (spec §5.1). An unknown tool fails the parse and the turn falls back to `fallbackPlan`. */
export const planSchema = z.object({
  steps: z.array(z.discriminatedUnion("tool", [
    z.object({ tool: z.literal("line_analysis") }),
    z.object({ tool: z.literal("dictionary_lookup"), term: z.string() }),
    z.object({ tool: z.literal("memory_lookup"), topic: z.string() }),
    z.object({ tool: z.literal("learner_exposure"), term: z.string() }),
    z.object({ tool: z.literal("knowledge_lookup"), section: z.enum(KNOWLEDGE_SECTIONS) }),
  ])).max(MAX_PARSED_STEPS),
});

const ANCHOR_ONLY = new Set<PlanStep["tool"]>(["line_analysis", "knowledge_lookup"]);
const HAS_LETTER = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z]/u;

const normalize = (s: string) => s.normalize("NFKC").trim();
const usable = (s: string, max: number) => {
  const length = Array.from(s).length;
  return length >= 1 && length <= max && HAS_LETTER.test(s);
};

/**
 * The server's say over the model's plan (spec §5.1, Review Focus 4): normalize every argument, drop what is
 * malformed or needs an anchor the thread does not have, dedupe, and keep the first four in the planner's order.
 */
export function validatePlan(raw: { steps: readonly PlanStep[] }, ctx: { hasAnchor: boolean }): PlanStep[] {
  const seen = new Set<string>();
  const out: PlanStep[] = [];
  for (const step of raw.steps) {
    if (!ctx.hasAnchor && ANCHOR_ONLY.has(step.tool)) continue;
    let clean: PlanStep;
    switch (step.tool) {
      case "line_analysis": clean = step; break;
      case "knowledge_lookup": clean = step; break;
      case "dictionary_lookup":
      case "learner_exposure": {
        const term = normalize(step.term);
        if (!usable(term, 32)) continue;
        clean = { tool: step.tool, term };
        break;
      }
      case "memory_lookup": {
        const topic = normalize(step.topic);
        if (!usable(topic, 64)) continue;
        clean = { tool: step.tool, topic };
        break;
      }
    }
    const key = stepKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length === MAX_PLAN_STEPS) break;
  }
  return out;
}

/** What retrieval does when the planner fails: the anchored sentence's own analysis, or nothing. */
export function fallbackPlan(ctx: { hasAnchor: boolean }): PlanStep[] {
  return ctx.hasAnchor ? [{ tool: "line_analysis" }] : [];
}

export function stepKey(step: PlanStep): string {
  switch (step.tool) {
    case "line_analysis": return "line_analysis";
    case "dictionary_lookup": return `dictionary_lookup:${step.term}`;
    case "memory_lookup": return `memory_lookup:${step.topic}`;
    case "learner_exposure": return `learner_exposure:${step.term}`;
    case "knowledge_lookup": return `knowledge_lookup:${step.section}`;
  }
}
