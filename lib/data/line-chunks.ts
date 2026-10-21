import "server-only";
import { createClient } from "@/lib/supabase/server";
import { chunkLine, lineTextHash, typingHintUnit } from "@/lib/dictation/chunk";
import type { LineChunks } from "@/lib/dictation";

export type LineChunksResult = { kind: "ok"; data: LineChunks } | { kind: "unauthorized" } | { kind: "not_found" };

/**
 * P12: every request authenticates and reads the line under the learner's RLS (the access of
 * `/api/lines/[lineId]/analysis`) before the chunker's memo — keyed by the text just read, never by
 * `lineId` — is consulted.
 */
export async function loadLineChunks(lineId: string): Promise<LineChunksResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthorized" };

  const { data, error } = await supabase.from("transcript_lines").select("text_jp").eq("id", lineId).maybeSingle();
  if (error) throw error;
  const text = (data as { text_jp: string | null } | null)?.text_jp;
  if (!text) return { kind: "not_found" };

  const cut = await chunkLine(text);
  return { kind: "ok", data: {
    version: cut.version,
    textHash: lineTextHash(text),
    reliable: cut.reliable,
    reason: cut.reason,
    chunks: cut.chunks,
    typingHintUnit: typingHintUnit(cut),
  } };
}
