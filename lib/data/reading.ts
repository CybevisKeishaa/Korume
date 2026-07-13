import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/data/gamification";
import { scoreReadingQuiz } from "@/lib/jlpt";
import type { JlptLevel, ReadingQuizResult, ScoredReadingQuestion } from "@/lib/jlpt";
import type { ReadingSubmitInput } from "@/lib/validation/reading";
import { toFurigana } from "@/lib/japanese";
import type { FuriganaSegment } from "@/lib/japanese";

/**
 * Reading-module data layer (CLAUDE.md §5, spec §3.7). Same auth posture
 * split as `lib/data/jlpt.ts`: list/detail reads are plain RLS-scoped
 * queries (no explicit 401 — matches `lib/data/content.ts`), submissions are
 * owner-scoped writes that check auth explicitly.
 */

const SUBMIT_LIMIT = { limit: 20, windowMs: 60_000 };

const LIST_COLUMNS = "id, title, jlpt_level, word_count, created_at";
const DETAIL_COLUMNS = "id, title, jlpt_level, body_jp, body_translation, furigana_json, word_count, created_at";

export interface ReadingPassageListItem {
  id: string;
  title: string;
  jlpt_level: JlptLevel;
  word_count: number | null;
  created_at: string;
}

export interface ReadingQuestionPublic {
  id: string;
  question: string;
  options: string[];
  order_index: number;
}

export interface ReadingPassageDetail {
  id: string;
  title: string;
  jlpt_level: JlptLevel;
  body_jp: string;
  body_translation: string | null;
  /**
   * NULL in seed data (see migration 20260713000012). Generated
   * lazily on first read via `ensureFurigana` below (same shape
   * `lib/data/transcripts.ts` stores at transcript-ingest time —
   * `FuriganaSegment[]`, consumed as-is by
   * `components/video-player/furigana-text.tsx`) and cached back onto the
   * row through the service-role client, mirroring the generate-once-cache
   * pattern in `lib/data/video-summary.ts::generateVideoSummary`. Stays
   * `null` if generation fails — the request still succeeds either way.
   */
  furigana_json: FuriganaSegment[] | null;
  word_count: number | null;
  created_at: string;
  questions: ReadingQuestionPublic[];
}

interface ScoredReadingQuestionRow {
  id: string;
  correct_answer: string;
  explanation: string | null;
}

interface PassageRow {
  id: string;
  title: string;
  jlpt_level: JlptLevel;
  body_jp: string;
  body_translation: string | null;
  furigana_json: FuriganaSegment[] | null;
  word_count: number | null;
  created_at: string;
}

/**
 * Returns `passage.furigana_json` as-is when already populated. Otherwise
 * generates it via `toFurigana` (kuromoji tokenizer — the same pipeline
 * `lib/data/transcripts.ts::saveTranscript` runs at ingest time) and caches
 * the result back onto the row through the service-role client (RLS grants
 * `authenticated` no write on `reading_passages` — see migration
 * 20260713000011, same shape as the `video_summaries` write path).
 *
 * Both generation and the cache write are best-effort: a tokenizer failure
 * or a write error is logged and swallowed rather than failing the read —
 * the passage itself (and its plain, furigana-less `body_jp`) is still
 * useful, and `furigana-text.tsx` already tolerates a missing reading.
 */
async function ensureFurigana(passage: PassageRow): Promise<FuriganaSegment[] | null> {
  if (passage.furigana_json !== null) return passage.furigana_json;

  let generated: FuriganaSegment[];
  try {
    generated = await toFurigana(passage.body_jp);
  } catch (err) {
    console.error(`[reading] furigana generation failed for passage ${passage.id}:`, err);
    return null;
  }

  const service = createServiceClient();
  const { error } = await service
    .from("reading_passages")
    .update({ furigana_json: generated })
    .eq("id", passage.id);
  if (error) {
    console.error(`[reading] failed to cache furigana for passage ${passage.id}:`, error);
  }

  return generated;
}

/** All reading passages, optionally filtered by JLPT level. */
export async function listReadingPassages(level?: JlptLevel): Promise<ReadingPassageListItem[]> {
  const supabase = createClient();
  let query = supabase.from("reading_passages").select(LIST_COLUMNS).order("created_at", { ascending: false });
  if (level) query = query.eq("jlpt_level", level);

  const { data, error } = await query;
  if (error) throw error;
  return (data as ReadingPassageListItem[]) ?? [];
}

/** One passage's full readable content plus its questions, ordered — never
 * `correct_answer`/`explanation` (column-scoped grant excludes them from the
 * normal client; this list matches that grant exactly). */
export async function getReadingPassageDetail(passageId: string): Promise<ReadingPassageDetail | null> {
  const supabase = createClient();
  const { data: passage, error: passageError } = await supabase
    .from("reading_passages")
    .select(DETAIL_COLUMNS)
    .eq("id", passageId)
    .maybeSingle();
  if (passageError) throw passageError;
  if (!passage) return null;

  const { data: questions, error: qError } = await supabase
    .from("reading_questions")
    .select("id, question, options, order_index")
    .eq("passage_id", passageId)
    .order("order_index", { ascending: true });
  if (qError) throw qError;

  const passageRow = passage as PassageRow;
  const furiganaJson = await ensureFurigana(passageRow);

  return {
    ...passageRow,
    furigana_json: furiganaJson,
    questions: (questions as ReadingQuestionPublic[]) ?? [],
  };
}

export type SubmitReadingResult =
  | { ok: true; data: ReadingSubmitResponse }
  | { ok: false; status: 401 | 404 | 400 }
  | { ok: false; status: 429; retryAfter: number };

export interface ReadingSubmitResponse {
  result: ReadingQuizResult;
  perQuestion: { id: string; correct: boolean; correctAnswer: string; explanation: string | null }[];
  attemptId: string;
}

/** Score and persist one reading-comprehension attempt. `correct_answer`/
 * `explanation` are read via the service-role client, same pattern as
 * `lib/data/jlpt.ts::submitJlptTest`. */
export async function submitReadingQuiz(passageId: string, input: ReadingSubmitInput): Promise<SubmitReadingResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`reading:submit:${user.id}`, SUBMIT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: passage, error: passageError } = await supabase
    .from("reading_passages")
    .select("id")
    .eq("id", passageId)
    .maybeSingle();
  if (passageError) throw passageError;
  if (!passage) return { ok: false, status: 404 };

  const service = createServiceClient();
  const { data: questionRows, error: qError } = await service
    .from("reading_questions")
    .select("id, correct_answer, explanation")
    .eq("passage_id", passageId);
  if (qError) throw qError;

  const questions = (questionRows as ScoredReadingQuestionRow[]) ?? [];
  if (questions.length === 0) return { ok: false, status: 400 };

  const scored: ScoredReadingQuestion[] = questions.map((q) => ({ id: q.id, correct_answer: q.correct_answer }));
  const result = scoreReadingQuiz(scored, input.answers);
  const correctById = new Map(result.perQuestion.map((p) => [p.id, p.correct]));

  const perQuestion = questions.map((q) => ({
    id: q.id,
    correct: correctById.get(q.id) ?? false,
    correctAnswer: q.correct_answer,
    explanation: q.explanation ?? null,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("user_reading_attempts")
    .insert({
      user_id: user.id,
      passage_id: passageId,
      answers: input.answers,
      score: result.percent,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError) return { ok: false, status: 400 };

  // Best-effort: gamification never fails a learning-flow request (see
  // lib/data/gamification.ts::recordActivity).
  await recordActivity({ userId: user.id, source: "reading_submit", parts: { passageId } });

  return {
    ok: true,
    data: { result, perQuestion, attemptId: (inserted as { id: string }).id },
  };
}
