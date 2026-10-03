import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { KnowledgeLocale, PlanTier } from "@/lib/knowledge/types";
import { RETRIEVAL_DEADLINE_MS, TOOL_DEADLINE_MS } from "./limits";
import { stepKey, type PlanStep } from "./plan";
import { lineAnalysisTool } from "./tools/line-analysis";
import { dictionaryTool } from "./tools/dictionary";
import { memoryTool } from "./tools/memory";
import { knowledgeTool } from "./tools/knowledge";
import { exposureTool } from "./tools/exposure";

type Supabase = ReturnType<typeof createClient>;

export type ToolName = PlanStep["tool"];

export interface ToolResult<T = unknown> {
  tool: ToolName;
  key: string;
  status: "ok" | "not_found" | "error";
  data?: T;
  /** Never an error message: a database or provider detail must not reach a prompt or a client (spec §5.2). */
  errorCode?: "timeout" | "unavailable";
}

export interface RetrievalContext {
  supabase: Supabase;
  userId: string;
  tier: PlanTier;
  locale: KnowledgeLocale;
  anchor: { lineId: string; videoId: string; lineText: string; videoTitle: string } | null;
}

export type Tool = (step: PlanStep, ctx: RetrievalContext) => Promise<Pick<ToolResult, "status" | "data">>;

export const DEFAULT_TOOLS: Record<ToolName, Tool> = {
  line_analysis: lineAnalysisTool,
  dictionary_lookup: dictionaryTool,
  memory_lookup: memoryTool,
  knowledge_lookup: knowledgeTool,
  learner_exposure: exposureTool,
};

const TIMED_OUT = Symbol("timeout");

function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Runs the validated plan in parallel (spec §5.2). Each tool has its own deadline and the stage has one more; a
 * tool that throws, hangs or is missing becomes an `error` result and never takes the others down.
 */
export async function runRetrieval(
  steps: PlanStep[],
  ctx: RetrievalContext,
  tools: Partial<Record<ToolName, Tool>> = DEFAULT_TOOLS,
  clock: { toolMs: number; stageMs: number } = { toolMs: TOOL_DEADLINE_MS, stageMs: RETRIEVAL_DEADLINE_MS },
): Promise<ToolResult[]> {
  const results: ToolResult[] = steps.map((step) => ({ tool: step.tool, key: stepKey(step), status: "error", errorCode: "timeout" }));
  const runs = steps.map(async (step, i) => {
    const tool = tools[step.tool];
    const base = { tool: step.tool, key: stepKey(step) };
    if (!tool) { results[i] = { ...base, status: "error", errorCode: "unavailable" }; return; }
    try {
      const outcome = await within(tool(step, ctx), clock.toolMs);
      results[i] = outcome === TIMED_OUT
        ? { ...base, status: "error", errorCode: "timeout" }
        : { ...base, status: outcome.status, ...(outcome.data === undefined ? {} : { data: outcome.data }) };
    } catch (error) {
      // eslint-disable-next-line no-console -- server-side diagnostics only; the result carries a code.
      console.error(`[korume/retrieval] ${step.tool} failed:`, error);
      results[i] = { ...base, status: "error", errorCode: "unavailable" };
    }
  });
  await within(Promise.all(runs), clock.stageMs);
  // A tool still running at the stage deadline keeps its pre-filled `timeout`; a copy freezes the answer.
  return results.map((r) => ({ ...r }));
}
