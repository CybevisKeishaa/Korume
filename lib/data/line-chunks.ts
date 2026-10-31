import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { chunkLine, lineTextHash, lineTokens, typingHintUnit } from "@/lib/dictation/chunk";
import { lineRomaji } from "@/lib/japanese/romaji";
import { chunkDisplays, displayMap, normalizeJa, type LineChunks } from "@/lib/dictation";

export type LineChunksResult = { kind: "ok"; data: LineChunks } | { kind: "unauthorized" } | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfter: number };

/** One budget for the chunks and cloze reads: each runs the tokenizer on a line the learner may have written. */
export const LINE_ANSWER_LIMIT = { limit: 120, windowMs: 60_000 };

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
  const limited = rateLimit(`lines:answer:${user.id}`, LINE_ANSWER_LIMIT);
  if (!limited.ok) return { kind: "rate_limited", retryAfter: limited.retryAfter };

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
    display: chunkDisplays(displayMap(text), normalizeJa(text), cut.chunks),
    typingHintUnit: typingHintUnit(cut),
    romaji: lineRomaji(await lineTokens(text)),
  } };
}
