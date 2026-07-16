/**
 * Typed error surface for `lib/ai`. Routes catch {@link AiError} and branch on
 * `.kind` — never on string messages. Each provider adapter maps its own
 * SDK's failures onto this union (see each adapter's own `toAiError`).
 */

/**
 * The small, route-actionable error union.
 * - `not_configured` — no API key; map to 503 (feature disabled).
 * - `rate_limited` — 429 from the provider; back off / surface quota message.
 * - `auth` — bad/missing key at the API; 500 (server misconfig), do not retry.
 * - `unavailable` — 5xx / overloaded / connection failure; retryable.
 * - `invalid_output` — response could not be parsed into the expected schema
 *   (includes truncated structured output); regenerate.
 * - `unknown` — anything else.
 */
export type AiErrorKind =
  | "not_configured"
  | "rate_limited"
  | "auth"
  | "unavailable"
  | "invalid_output"
  | "unknown";

/** Base error thrown by every `lib/ai` function. Inspect `.kind`. */
export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AiError";
    this.kind = kind;
  }
}

/** Thrown when no AI provider is configured (`AI_PROVIDER=none`) — no request is ever attempted. */
export class AiNotConfiguredError extends AiError {
  constructor(
    message = "AI features are disabled for this deployment (AI_PROVIDER=none).",
  ) {
    super("not_configured", message);
    this.name = "AiNotConfiguredError";
  }
}
