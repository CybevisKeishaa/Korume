import "server-only";
import { containsPattern } from "@/lib/data/query-pagination";
import type { Tool } from "../retrieval";

const MAX_MEMORIES = 3;
const COLUMNS = "id, memory_type, title, line_text_jp, note, occurred_at";

interface MemoryRow { id: string; memory_type: string; title: string | null; line_text_jp: string | null; note: string | null; occurred_at: string }

/**
 * Korume Memory, READ ONLY (spec §0): nothing in Ask Korume writes `companion_memories`. Two plain `ilike`
 * filters instead of one `or(...)`, so a topic with a comma or a parenthesis cannot bend PostgREST's grammar.
 */
export const memoryTool: Tool = async (step, ctx) => {
  if (step.tool !== "memory_lookup") return { status: "not_found" };
  const pattern = containsPattern(step.topic);
  const reads = await Promise.all(["line_text_jp", "title"].map((column) => ctx.supabase.from("companion_memories")
    .select(COLUMNS).eq("user_id", ctx.userId).ilike(column, pattern)
    .order("occurred_at", { ascending: false }).limit(MAX_MEMORIES)));
  const byId = new Map<string, MemoryRow>();
  for (const { data, error } of reads) {
    if (error) throw error;
    for (const row of (data ?? []) as MemoryRow[]) byId.set(row.id, row);
  }
  const memories = [...byId.values()].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, MAX_MEMORIES)
    .map((m) => ({ type: m.memory_type, title: m.title, lineTextJp: m.line_text_jp, note: m.note, occurredAt: m.occurred_at }));
  return memories.length ? { status: "ok", data: { topic: step.topic, memories } } : { status: "not_found" };
};
