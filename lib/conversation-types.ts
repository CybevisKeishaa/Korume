/**
 * Client-safe shared types for the voice-conversation feature (spec §3.6 +
 * §10.5, CLAUDE.md §5.5). These mirror the JSON shapes returned by
 * `lib/data/conversation.ts` (`/api/conversation/*`) — structurally identical
 * to `ConversationSessionRow`/`ConversationMessageRow` there, so server
 * components can pass that module's return values straight through as props
 * without a cast. This module has NO runtime imports, so it is safe to import
 * from client components — unlike `lib/data/conversation.ts`, which is
 * `server-only`.
 */

/** Must stay in sync with `lib/validation/conversation.ts`'s `SCENARIO_IDS`. */
export const SCENARIO_IDS = [
  "restaurant",
  "interview",
  "shopping",
  "directions",
  "free-talk",
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export const JLPT_LEVELS: readonly JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export interface ConversationSessionRow {
  id: string;
  scenario_type: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface ConversationMessageRow {
  id: string;
  role: "user" | "ai";
  content: string;
  pronunciation_score: number | null;
  created_at: string;
}

/** One entry of `POST /api/conversation/session/[id]/end`'s `corrections[]`. */
export interface CorrectionItem {
  original: string;
  corrected: string;
  explanation: string;
}

/** `POST /api/conversation/session/[id]/end`'s `data` shape. */
export interface SessionEndResult {
  corrections: CorrectionItem[];
  encouragement: string;
  model: string;
}
