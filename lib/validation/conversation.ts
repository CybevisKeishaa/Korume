import { z } from "zod";
import { jlptLevelSchema } from "@/lib/validation/content";

/**
 * Scenario ids the conversation chatbot supports. Kept as a local literal
 * tuple (rather than importing `lib/ai`'s `SCENARIO_IDS`, which is typed as
 * a widened `readonly ScenarioId[]`) so `z.enum` gets the literal tuple type
 * it needs. Must stay in sync with `lib/ai/types.ts`'s `ScenarioId` union.
 */
export const SCENARIO_IDS = [
  "restaurant",
  "interview",
  "shopping",
  "directions",
  "free-talk",
] as const;

/** POST /api/conversation/session body. `level` is validated but NOT persisted
 * (conversation_sessions has no level column — see migration 10's grants
 * audit) — pass it again per-message; it falls back to the user's profile
 * level (`users.level`) when omitted. */
export const createConversationSessionSchema = z.object({
  scenario: z.enum(SCENARIO_IDS),
  level: jlptLevelSchema.optional(),
});
export type CreateConversationSessionInput = z.infer<typeof createConversationSessionSchema>;

/** POST /api/conversation/message body. */
export const postConversationMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1, "Message is required.").max(1000, "Message is too long (max 1000 characters)."),
  level: jlptLevelSchema.optional(),
  /** Voice-mode pronunciation score, 0–100. CLIENT-SUPPLIED and therefore
   *  self-reported: a learning signal only, never an authorization input —
   *  nothing may grant access or award XP on it without server-side
   *  re-scoring. Column is `conversation_messages.pronunciation_score`,
   *  numeric(5,2) (`20260712000001_schema.sql`).
   *
   *  NOT YET WIRED: no caller currently sends this field. The client's
   *  voice-mode score (`components/conversation/conversation-app.tsx`) is
   *  computed only AFTER the message POST resolves (`scoreVoiceMessage` at
   *  :230, invoked from `sendMessage` at :308) and lives only in local React
   *  state, keyed by a client-only id the server has never seen — there is
   *  nothing to send at POST time today. Wiring a retroactive attach is a
   *  separate, scoped follow-up (would need the message POST to return the
   *  created row id, plus a new authenticated/rate-limited endpoint), not
   *  part of this schema change. */
  pronunciationScore: z.number().min(0).max(100).optional(),
});
export type PostConversationMessageInput = z.infer<typeof postConversationMessageSchema>;

/** Caps the turns sent to Claude per reply so a long-running session's token
 * cost/latency stays bounded (task brief: "cap history passed to Claude at
 * last ~20 turns"). */
export const MAX_CONVERSATION_HISTORY_TURNS = 20;

/**
 * Keep only the most recent `cap` turns, preserving order (oldest of the kept
 * turns first). Pure and generic so it's directly unit-testable.
 */
export function capHistory<T>(turns: readonly T[], cap: number = MAX_CONVERSATION_HISTORY_TURNS): T[] {
  if (turns.length <= cap) return [...turns];
  return turns.slice(turns.length - cap);
}
