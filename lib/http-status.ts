import type { AiErrorKind } from "@/lib/ai";
import type { SpeechErrorKind } from "@/lib/speech-scoring";

/**
 * Maps a `lib/ai` {@link AiErrorKind} to the HTTP status an AI-backed route
 * should return. Pure and deterministic so it's unit-testable without
 * touching the Anthropic SDK — see the suggested mapping in the Layer 4 task
 * brief (CLAUDE.md §6 — never leak upstream error bodies to the client).
 *
 * - `not_configured` / `unavailable` -> 503 (feature off / upstream down)
 * - `rate_limited` -> 429 (Anthropic's own quota, distinct from our limiter)
 * - `auth` -> 500 (our server-side key is misconfigured; never the client's fault)
 * - `invalid_output` / `unknown` -> 502 (bad gateway: upstream misbehaved)
 */
export function aiErrorStatus(kind: AiErrorKind): number {
  switch (kind) {
    case "not_configured":
    case "unavailable":
      return 503;
    case "rate_limited":
      return 429;
    case "auth":
      return 500;
    case "invalid_output":
    case "unknown":
      return 502;
  }
}

/**
 * Maps a `lib/speech-scoring` {@link SpeechErrorKind} to the HTTP status a
 * speech-backed route should return.
 *
 * - `not_configured` -> 503 (no Azure creds; a normal, expected state today)
 * - `auth` -> 502 (our key is bad upstream; never surface it to the client)
 * - `throttled` -> 429 (Azure itself throttled us)
 * - `request` -> 502 (any other upstream failure)
 * - `recognition` -> 422 (audio produced no usable recognition — a client input problem)
 */
export function speechErrorStatus(kind: SpeechErrorKind): number {
  switch (kind) {
    case "not_configured":
      return 503;
    case "auth":
      return 502;
    case "throttled":
      return 429;
    case "request":
      return 502;
    case "recognition":
      return 422;
  }
}

/**
 * Fixed Retry-After (ms) surfaced when Azure itself throttles us
 * (`SpeechThrottledError`). Azure's REST error doesn't carry a machine-readable
 * Retry-After value, so this is a conservative fixed backoff — distinct from
 * our own limiter's computed `retryAfter`, which is exact.
 */
export const SPEECH_THROTTLE_RETRY_AFTER_MS = 30_000;
