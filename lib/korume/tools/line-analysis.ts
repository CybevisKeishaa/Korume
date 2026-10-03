import "server-only";
import { staticAnalyses } from "@/lib/analysis/line-analysis";
import type { Tool } from "../retrieval";

/**
 * The anchored sentence's tokens and grammar. Calls the shared, learner-free `staticAnalyses` directly on the line
 * the thread already proved readable — `getLineAnalysisForLearner` would re-read the line and spend the learner's
 * analysis rate limit (plan Correction 7). Only the first dictionary entry per token reaches the prompt.
 */
export const lineAnalysisTool: Tool = async (_step, ctx) => {
  if (!ctx.anchor) return { status: "not_found" };
  const analysis = (await staticAnalyses(ctx.supabase, [{ id: ctx.anchor.lineId, textJp: ctx.anchor.lineText }])).get(ctx.anchor.lineId);
  if (!analysis) return { status: "not_found" };
  return {
    status: "ok",
    data: {
      tokens: analysis.tokens.map((t) => {
        const entry = t.entries[0];
        return {
          surface: t.surface, base: t.base, reading: t.reading, pos: t.pos,
          ...(entry ? { entSeq: entry.entSeq, headword: entry.headword, gloss: entry.glossEn, jlpt: entry.jlpt } : {}),
        };
      }),
      grammar: analysis.grammar.map((g) => ({ title: g.title, structure: g.structure, explanation: g.explanation })),
    },
  };
};
