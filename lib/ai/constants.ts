/**
 * Shared constants for the server-only Claude wrapper (`lib/ai`).
 *
 * The default model lives in exactly one place (`AI_MODEL`) so a model bump is
 * a one-line change. Per the Anthropic API rules for Opus 4.8, we never send
 * `temperature`/`top_p`/`top_k` or a `budget_tokens` thinking config — those
 * 400 on this model.
 */

/** The one model string every `lib/ai` call uses. No date suffix (Opus 4.8). */
export const AI_MODEL = "claude-opus-4-8" as const;

/**
 * Source tag written alongside AI-generated study content so it can be labelled
 * in the UI and gated behind human review before publish (CLAUDE.md §2.3, §3.3).
 */
export const AI_SOURCE = "ai_generated" as const;

/**
 * `max_tokens` budgets per feature. Chat replies and example sentences are
 * short; corrections are a small structured list; summaries are the largest.
 * All are well under the streaming threshold, so non-streaming is fine.
 */
export const MAX_TOKENS = {
  chat: 1024,
  examples: 1024,
  corrections: 2048,
  summary: 4096,
} as const;

/**
 * Deterministic cap on transcript characters fed to the summariser. Past this,
 * the transcript is truncated and the prompt is told so (keeps the request
 * bounded and the cost predictable). ~6k chars comfortably fits the summary
 * budget with room for the model's output.
 */
export const TRANSCRIPT_CHAR_CAP = 6000;
