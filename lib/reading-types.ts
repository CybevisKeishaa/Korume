/**
 * Client-safe shared types for the JLPT Reading module (CLAUDE.md §5 / Layer
 * 5, spec §3.7). These mirror the JSON shapes returned by `/api/reading/*`
 * (see the data layer in `lib/data/reading.ts`, which is server-only and NOT
 * imported here) so client components can consume the API directly without
 * any runtime coupling to server-only code — same duplication pattern as
 * `lib/conversation-types.ts` / `lib/video-types.ts`.
 */
export type { FuriganaSegment } from "@/lib/video-types";
import type { FuriganaSegment } from "@/lib/video-types";

export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export const JLPT_LEVELS: readonly JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

/** `GET /api/reading` list item. */
export interface ReadingPassageListItem {
  id: string;
  title: string;
  jlpt_level: JlptLevel;
  word_count: number | null;
  created_at: string;
}

/** One entry of `GET /api/reading/[id]`'s `questions[]` — never carries the
 * answer key (that's scored server-side only). */
export interface ReadingQuestionPublic {
  id: string;
  question: string;
  options: string[];
  order_index: number;
}

/** `GET /api/reading/[id]`'s `data` shape. */
export interface ReadingPassageDetail {
  id: string;
  title: string;
  jlpt_level: JlptLevel;
  body_jp: string;
  body_translation: string | null;
  /** null when lazy furigana generation failed server-side — render plain text. */
  furigana_json: FuriganaSegment[] | null;
  word_count: number | null;
  created_at: string;
  questions: ReadingQuestionPublic[];
}

/** `POST /api/reading/[id]/submit`'s `result` field. */
export interface ReadingQuizResult {
  correct: number;
  total: number;
  percent: number;
}

/** One entry of `POST /api/reading/[id]/submit`'s `perQuestion[]`. */
export interface ReadingPerQuestionResult {
  id: string;
  correct: boolean;
  correctAnswer: string;
  explanation: string | null;
}

/** `POST /api/reading/[id]/submit`'s `data` shape. */
export interface ReadingSubmitResponse {
  result: ReadingQuizResult;
  perQuestion: ReadingPerQuestionResult[];
  attemptId: string;
}

/** Chosen-choice index — matches `reading_questions.correct_answer`'s convention. */
export type ReadingAnswerValue = "0" | "1" | "2" | "3";
