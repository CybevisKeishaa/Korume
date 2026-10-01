import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { fetchAllPages } from "@/lib/data/query-pagination";
import { rateLimit } from "@/lib/rate-limit";
import type { SentenceMarkKind } from "@/lib/preferences/options";

const WRITE_LIMIT = { limit: 30, windowMs: 60_000 };

export interface SentenceMarkDto {
  lineId: string;
  kind: SentenceMarkKind;
}

export type SetSentenceMarkResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function listMySentenceMarks(transcriptId: string): Promise<SentenceMarkDto[]> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return [];
  const rows = await fetchAllPages<{ transcript_line_id: string; kind: SentenceMarkKind }>((from, to) => supabase
    .from("sentence_marks")
    .select("transcript_line_id, kind, transcript_lines!inner(transcript_id)")
    .eq("user_id", user.id)
    .eq("transcript_lines.transcript_id", transcriptId)
    .order("transcript_line_id", { ascending: true })
    .order("kind", { ascending: true })
    .range(from, to));
  return rows.map(({ transcript_line_id, kind }) => ({ lineId: transcript_line_id, kind }));
}

export async function setSentenceMark(
  lineId: string,
  kind: SentenceMarkKind,
  marked: boolean,
): Promise<SetSentenceMarkResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const limit = rateLimit(`sentence-mark:${user.id}`, WRITE_LIMIT);
  if (!limit.ok) return { ok: false, status: 429, retryAfter: limit.retryAfter };
  if (!marked) {
    const { error } = await supabase.from("sentence_marks").delete()
      .eq("user_id", user.id).eq("transcript_line_id", lineId).eq("kind", kind);
    if (error) throw error;
    return { ok: true };
  }
  const { error } = await supabase.from("sentence_marks").insert({
    user_id: user.id, transcript_line_id: lineId, kind,
  });
  if (!error || error.code === "23505") return { ok: true };
  if (error.code === "42501" || error.code === "23503") return { ok: false, status: 404 };
  throw error;
}
