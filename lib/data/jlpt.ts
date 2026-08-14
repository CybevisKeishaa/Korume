import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/data/gamification";
import { scoreJlptAttempt, weaknessStats } from "@/lib/jlpt";
import type { JlptAttemptResult, JlptLevel, JlptSection, ScoredQuestion, WeaknessStat } from "@/lib/jlpt";
import type { JlptSubmitInput } from "@/lib/validation/jlpt";

/**
 * JLPT test-engine data layer (CLAUDE.md §5, spec §5.7-§5.8). Auth posture
 * mirrors the existing content routes (`lib/data/content.ts` — kanji/vocab/
 * grammar): list/detail reads are plain, unauthenticated-looking queries —
 * `jlpt_tests`/`jlpt_questions` RLS already scopes `select` to the
 * `authenticated` role, so a signed-out request is blocked by RLS itself
 * (empty result) rather than an explicit 401 here. Submissions and the
 * attempt history are owner-scoped writes/reads, so those DO check auth
 * explicitly, exactly like `lib/data/srs.ts`/`lib/data/dictation.ts`.
 */

const SUBMIT_LIMIT = { limit: 20, windowMs: 60_000 };

const TEST_COLUMNS = "id, level, title, section_config";

export interface JlptTestListItem {
  id: string;
  level: JlptLevel;
  title: string;
  section_config: unknown;
}

/** Public shape of a question — NEVER includes `correct_answer`/`explanation`
 * (the DB column-scoped grant is the backstop; this is the client-facing shape). */
export interface JlptQuestionPublic {
  id: string;
  section: JlptSection;
  question_type: string;
  order_index: number;
  question_data: PublicQuestionData;
}

export interface PublicQuestionData {
  stem: string;
  passage?: string;
  audio_text?: string;
  choices: string[];
}

export interface JlptTestDetail extends JlptTestListItem {
  questions: JlptQuestionPublic[];
}

interface RawQuestionRow {
  id: string;
  section: JlptSection;
  question_type: string;
  order_index: number;
  question_data: unknown;
}

interface ScoredQuestionRow {
  id: string;
  section: JlptSection;
  question_type: string;
  correct_answer: string;
  explanation: string | null;
  order_index: number;
}

/** All JLPT mock tests, optionally filtered by level. */
export async function listJlptTests(level?: JlptLevel): Promise<JlptTestListItem[]> {
  const supabase = createClient();
  let query = supabase.from("certification_tests").select(TEST_COLUMNS).order("level", { ascending: true });
  if (level) query = query.eq("level", level);

  const { data, error } = await query;
  if (error) throw error;
  return (data as JlptTestListItem[]) ?? [];
}

/**
 * One test's metadata plus its questions, ordered, stripped to the fields
 * safe to hand to a client (never `correct_answer`/`explanation`). Reads the
 * normal (RLS-scoped) client — `select("id, test_id, section, question_data,
 * question_type, order_index")` matches exactly the column-scoped grant from
 * migration 20260713000011, so this list is also the backstop if that grant
 * is ever widened by mistake.
 */
export async function getJlptTestDetail(testId: string): Promise<JlptTestDetail | null> {
  const supabase = createClient();
  const { data: test, error: testError } = await supabase
    .from("certification_tests")
    .select(TEST_COLUMNS)
    .eq("id", testId)
    .maybeSingle();
  if (testError) throw testError;
  if (!test) return null;

  const { data: questions, error: qError } = await supabase
    .from("certification_questions")
    .select("id, section, question_type, order_index, question_data")
    .eq("test_id", testId)
    .order("order_index", { ascending: true });
  if (qError) throw qError;

  const publicQuestions: JlptQuestionPublic[] = ((questions as RawQuestionRow[]) ?? []).map((q) => ({
    id: q.id,
    section: q.section,
    question_type: q.question_type,
    order_index: q.order_index,
    question_data: toPublicQuestionData(q.question_data),
  }));

  return { ...(test as JlptTestListItem), questions: publicQuestions };
}

/**
 * Strips `question_data` down to exactly {stem, passage?, audio_text?,
 * choices} — defensive even though the column grant already excludes
 * `correct_answer`/`explanation` as top-level columns, in case a future
 * content-authoring bug puts extra fields (or the answer key) inside the
 * jsonb blob itself.
 */
function toPublicQuestionData(raw: unknown): PublicQuestionData {
  const d = (raw ?? {}) as Partial<PublicQuestionData>;
  const out: PublicQuestionData = { stem: d.stem ?? "", choices: d.choices ?? [] };
  if (d.passage !== undefined) out.passage = d.passage;
  if (d.audio_text !== undefined) out.audio_text = d.audio_text;
  return out;
}

export type SubmitJlptResult =
  | { ok: true; data: JlptSubmitResponse }
  | { ok: false; status: 401 | 404 | 400 }
  | { ok: false; status: 429; retryAfter: number };

export interface JlptSubmitResponse {
  result: JlptAttemptResult;
  weakness: WeaknessStat[];
  perQuestion: { id: string; correct: boolean; correctAnswer: string; explanation: string | null }[];
  attemptId: string;
}

/**
 * Score and persist one JLPT test attempt (full test or a single practice
 * section). Answers are scored server-side against `correct_answer`, which
 * is only readable via the service-role client (RLS/column-grant excludes it
 * from the normal client — see migration 20260713000011).
 *
 * Score-column convention (documented here since the DB column is a single
 * generic `numeric`): `mode: 'full'` stores `result.scaledTotal` — the
 * approximate 0-180 scaled score, which is nullable when a pass estimate
 * isn't computable (e.g. a pillar had zero questions in this test). `mode:
 * 'section'` has no scaled total (that requires the whole test across all
 * pillars), so it stores `result.totalPercent` instead — the raw
 * percent-correct for that one section, which is always computable.
 */
export async function submitJlptTest(testId: string, input: JlptSubmitInput): Promise<SubmitJlptResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`jlpt:submit:${user.id}`, SUBMIT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: test, error: testError } = await supabase
    .from("certification_tests")
    .select("id, level")
    .eq("id", testId)
    .maybeSingle();
  if (testError) throw testError;
  if (!test) return { ok: false, status: 404 };

  const service = createServiceClient();
  let questionQuery = service
    .from("certification_questions")
    .select("id, section, question_type, correct_answer, explanation, order_index")
    .eq("test_id", testId);
  if (input.mode === "section" && input.section) {
    questionQuery = questionQuery.eq("section", input.section);
  }
  const { data: questionRows, error: qError } = await questionQuery;
  if (qError) throw qError;

  const questions = (questionRows as ScoredQuestionRow[]) ?? [];
  if (questions.length === 0) return { ok: false, status: 400 };

  const scored: ScoredQuestion[] = questions.map((q) => ({
    id: q.id,
    section: q.section,
    question_type: q.question_type,
    correct_answer: q.correct_answer,
    order_index: q.order_index,
  }));

  const level = (test as { level: JlptLevel }).level;
  const result = scoreJlptAttempt(scored, input.answers, input.mode, level);
  const weakness = weaknessStats(scored, input.answers);

  const perQuestion = questions.map((q) => ({
    id: q.id,
    correct: input.answers[q.id] === q.correct_answer,
    correctAnswer: q.correct_answer,
    explanation: q.explanation ?? null,
  }));

  const score = input.mode === "full" ? result.scaledTotal : result.totalPercent;

  const { data: inserted, error: insertError } = await supabase
    .from("user_test_attempts")
    .insert({
      user_id: user.id,
      test_id: testId,
      score,
      section_scores: { sections: result.sections, pillars: result.pillars, mode: input.mode },
      answers: input.answers,
      mode: input.mode,
      section: input.mode === "section" ? (input.section ?? null) : null,
      // started_at is client-supplied and the countdown runs client-side: the
      // timer is a study aid, NOT enforced server-side. Never treat attempt
      // duration as authoritative (e.g. for leaderboards) without adding
      // server-side timing first.
      started_at: input.started_at ?? new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError) return { ok: false, status: 400 };

  // Best-effort: gamification never fails a learning-flow request (see
  // lib/data/gamification.ts::recordActivity).
  await recordActivity({
    userId: user.id,
    source: "jlpt_submit",
    parts: { testId },
    jlptMode: input.mode,
    passed: result.passed === true,
  });

  return {
    ok: true,
    data: { result, weakness, perQuestion, attemptId: (inserted as { id: string }).id },
  };
}

export interface JlptAttemptRow {
  id: string;
  test_id: string;
  score: number | null;
  section_scores: unknown;
  mode: "full" | "section";
  section: JlptSection | null;
  started_at: string;
  completed_at: string | null;
}

export type ListJlptAttemptsResult = { ok: true; data: JlptAttemptRow[] } | { ok: false; status: 401 };

/** The current user's own attempts (RLS also scopes this; the explicit
 * `eq("user_id", ...)` filter matches the rest of the codebase's style —
 * e.g. `lib/data/mining.ts::listMiningCards`). */
export async function listJlptAttempts(testId?: string): Promise<ListJlptAttemptsResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  let query = supabase
    .from("user_test_attempts")
    .select("id, test_id, score, section_scores, mode, section, started_at, completed_at")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false });
  if (testId) query = query.eq("test_id", testId);

  const { data, error } = await query;
  if (error) throw error;
  return { ok: true, data: (data as JlptAttemptRow[]) ?? [] };
}
