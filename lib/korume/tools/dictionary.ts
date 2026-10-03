import "server-only";
import { entriesFor, lookupForms } from "@/lib/analysis/line-analysis";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import type { Tool } from "../retrieval";

/** JMdict on the active snapshot, ranked the way the line analysis ranks it; at most three entries. */
export const dictionaryTool: Tool = async (step, ctx) => {
  if (step.tool !== "dictionary_lookup") return { status: "not_found" };
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return { status: "not_found" };
  const matches = entriesFor(step.term, step.term, await lookupForms(ctx.supabase, snapshotId, [step.term]));
  return matches.length ? { status: "ok", data: { term: step.term, matches } } : { status: "not_found" };
};
