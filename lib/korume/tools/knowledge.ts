import "server-only";
import { readCachedSection } from "@/lib/knowledge/orchestrator";
import { contextKeyFor, sectionDefinition } from "@/lib/knowledge/registry";
import { fingerprint } from "@/lib/knowledge/canonical";
import type { Tool } from "../retrieval";

/**
 * A READY Knowledge section for the anchored sentence, at the learner's own tier (a Free learner gets the preview
 * projection of a locked section). Reads the cache only: Ask Korume never triggers a nested generation (spec §0).
 */
export const knowledgeTool: Tool = async (step, ctx) => {
  if (step.tool !== "knowledge_lookup" || !ctx.anchor) return { status: "not_found" };
  const definition = sectionDefinition(step.section);
  if (!definition) return { status: "not_found" };
  const parentFingerprint = fingerprint(ctx.anchor.lineText);
  const hit = await readCachedSection({
    definition,
    locale: ctx.locale,
    targetText: ctx.anchor.lineText,
    contextKey: contextKeyFor(definition, { videoId: ctx.anchor.videoId, parentFingerprint }),
    tier: ctx.tier,
  });
  return hit ? { status: "ok", data: { section: step.section, access: hit.access, content: hit.content } } : { status: "not_found" };
};
