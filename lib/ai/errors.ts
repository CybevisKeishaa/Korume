/**
 * Typed error surface for `lib/ai`. Routes catch {@link AiError} and branch on
 * `.kind` — never on string messages. All Anthropic SDK failures are mapped
 * here via the SDK's typed classes (most-specific first).
 */
import Anthropic from "@anthropic-ai/sdk";

/**
 * The small, route-actionable error union.
 * - `not_configured` — no API key; map to 503 (feature disabled).
 * - `rate_limited` — 429 from Anthropic; back off / surface quota message.
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

/** Thrown when `ANTHROPIC_API_KEY` is absent — no request is ever attempted. */
export class AiNotConfiguredError extends AiError {
  constructor(
    message = "AI features are disabled for this deployment (AI_PROVIDER=none).",
  ) {
    super("not_configured", message);
    this.name = "AiNotConfiguredError";
  }
}

/**
 * Maps any thrown value into a typed {@link AiError}. Uses the SDK's typed
 * classes (never message string-matching), most-specific first:
 *   RateLimitError (429) → AuthenticationError (401) → APIConnectionError →
 *   APIError (5xx/429 → unavailable, else unknown) → AnthropicError base
 *   (structured-output parse failures) → unknown.
 */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;

  // RateLimitError is a subclass of APIError — check it first.
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limited", err.message, { cause: err });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new AiError("auth", err.message, { cause: err });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError("unavailable", err.message, { cause: err });
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    const kind: AiErrorKind = status >= 500 || status === 429 ? "unavailable" : "unknown";
    return new AiError(kind, err.message, { cause: err });
  }
  // Base AnthropicError that isn't an APIError = client-side failure, most
  // notably `messages.parse()` failing to parse/validate structured output.
  if (err instanceof Anthropic.AnthropicError) {
    return new AiError("invalid_output", err.message, { cause: err });
  }

  const message = err instanceof Error ? err.message : String(err);
  return new AiError("unknown", message, {
    cause: err instanceof Error ? err : undefined,
  });
}
