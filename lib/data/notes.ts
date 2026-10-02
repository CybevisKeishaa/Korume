import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { fetchAllPages } from "@/lib/data/query-pagination";
import { rateLimit } from "@/lib/rate-limit";

// Autosave is debounced 800 ms per note (spec §5.5); 60 a minute leaves room for several open notes.
const WRITE_LIMIT = { limit: 60, windowMs: 60_000 };

export interface NoteDto {
  /** `sentence:<lineId>` or `lesson:<videoId>` — the client's autosave queue key. */
  key: string;
  lineId: string | null;
  videoId: string;
  body: string;
  updatedAt: string;
}

export type NoteWriteResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

type NoteTarget =
  | { table: "sentence_notes"; column: "transcript_line_id"; id: string }
  | { table: "lesson_notes"; column: "video_id"; id: string };

async function writeNote(target: NoteTarget, body: string | null): Promise<NoteWriteResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const limit = rateLimit(`note-write:${user.id}`, WRITE_LIMIT);
  if (!limit.ok) return { ok: false, status: 429, retryAfter: limit.retryAfter };
  if (!body) {
    const { error } = await supabase.from(target.table).delete().eq("user_id", user.id).eq(target.column, target.id);
    if (error) throw error;
    return { ok: true };
  }
  const { error } = await supabase.from(target.table).upsert(
    { user_id: user.id, [target.column]: target.id, body },
    { onConflict: `user_id,${target.column}` },
  );
  if (!error) return { ok: true };
  // RLS refusal (a line or lesson the learner cannot read) and a missing parent both read as "not found".
  if (error.code === "42501" || error.code === "23503") return { ok: false, status: 404 };
  throw error;
}

export function setSentenceNote(lineId: string, body: string): Promise<NoteWriteResult> {
  return writeNote({ table: "sentence_notes", column: "transcript_line_id", id: lineId }, body);
}
export function deleteSentenceNote(lineId: string): Promise<NoteWriteResult> {
  return writeNote({ table: "sentence_notes", column: "transcript_line_id", id: lineId }, null);
}
export function setLessonNote(videoId: string, body: string): Promise<NoteWriteResult> {
  return writeNote({ table: "lesson_notes", column: "video_id", id: videoId }, body);
}
export function deleteLessonNote(videoId: string): Promise<NoteWriteResult> {
  return writeNote({ table: "lesson_notes", column: "video_id", id: videoId }, null);
}

export async function listMyLessonNotes(
  videoId: string,
  /** null for a lesson without a transcript: only its lesson note is read. */
  transcriptId: string | null,
): Promise<{ lessonNote: NoteDto | null; sentenceNotes: NoteDto[] }> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { lessonNote: null, sentenceNotes: [] };
  const [lesson, rows] = await Promise.all([
    supabase.from("lesson_notes").select("body, updated_at").eq("user_id", user.id).eq("video_id", videoId).maybeSingle(),
    transcriptId === null ? Promise.resolve([]) : fetchAllPages<{ transcript_line_id: string; body: string; updated_at: string }>((from, to) => supabase
      .from("sentence_notes")
      .select("transcript_line_id, body, updated_at, transcript_lines!inner(transcript_id)")
      .eq("user_id", user.id)
      .eq("transcript_lines.transcript_id", transcriptId)
      .order("updated_at", { ascending: true })
      .order("transcript_line_id", { ascending: true })
      .range(from, to)),
  ]);
  if (lesson.error) throw lesson.error;
  const lessonRow = lesson.data as { body: string; updated_at: string } | null;
  return {
    lessonNote: lessonRow
      ? { key: `lesson:${videoId}`, lineId: null, videoId, body: lessonRow.body, updatedAt: lessonRow.updated_at }
      : null,
    sentenceNotes: rows.map((row) => ({
      key: `sentence:${row.transcript_line_id}`,
      lineId: row.transcript_line_id,
      videoId,
      body: row.body,
      updatedAt: row.updated_at,
    })),
  };
}
