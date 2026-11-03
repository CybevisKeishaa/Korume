import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { currentCut, cutKind, lineTextHash, lineTokens, typingHintUnit } from "@/lib/dictation/chunk";
import { lineRomaji } from "@/lib/japanese/romaji";
import { chunkDisplays, displayMap, normalizeJa, type LineChunks } from "@/lib/dictation";

export type LineChunksResult = { kind: "ok"; data: LineChunks } | { kind: "unauthorized" } | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfter: number };

/** One budget for the chunks and cloze reads: each runs the tokenizer on a line the learner may have written. */
export const LINE_ANSWER_LIMIT = { limit: 120, windowMs: 60_000 };

export type LineAnswerAccess = { kind: "ok"; supabase: ReturnType<typeof createClient>; userId: string; text: string }
  | { kind: "unauthorized" } | { kind: "not_found" } | { kind: "rate_limited"; retryAfter: number };

/**
 * P12, the one access rule of every line-answer read (chunks, cloze): authenticate, spend the shared budget, and read
 * the line under the learner's RLS (the access of `/api/lines/[lineId]/analysis`) before any memo is consulted;
 * memos are keyed by the text read here, never by `lineId`.
 */
export async function readLineForAnswer(lineId: string): Promise<LineAnswerAccess> {
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
  return { kind: "ok", supabase, userId: user.id, text };
}

/** The line's word-piece cut, behind `readLineForAnswer`. */
export async function loadLineChunks(lineId: string): Promise<LineChunksResult> {
  const line = await readLineForAnswer(lineId);
  if (line.kind !== "ok") return line;
  const { text } = line;

  const cut = await currentCut(text);
  return { kind: "ok", data: {
    version: cut.version,
    cut: cutKind(cut.version),
    textHash: lineTextHash(text),
    reliable: cut.reliable,
    reason: cut.reason,
    chunks: cut.chunks,
    display: chunkDisplays(displayMap(text), normalizeJa(text), cut.chunks),
    typingHintUnit: typingHintUnit(cut),
    romaji: lineRomaji(await lineTokens(text)),
  } };
}
