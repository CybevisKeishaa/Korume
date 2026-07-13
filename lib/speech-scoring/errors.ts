/**
 * Typed error union for the Azure Speech integration. Server-side only.
 *
 * Callers (API routes owned by `backend-engineer`) map these to HTTP status:
 *   - `SpeechNotConfiguredError`  → 503 (feature unavailable, no creds)
 *   - `SpeechAuthError`           → 502/500 (our key is bad — never surface key)
 *   - `SpeechThrottledError`      → 429 (upstream throttled; also our own limit)
 *   - `SpeechRequestError`        → 502 (other upstream failure)
 *   - `SpeechRecognitionError`    → 422 (audio produced no usable recognition)
 *
 * All extend `SpeechError` and carry a discriminant `kind` for exhaustive
 * matching without `instanceof` chains.
 */

export type SpeechErrorKind =
  | "not_configured"
  | "auth"
  | "throttled"
  | "request"
  | "recognition";

/** Base class for every error this module throws. */
export abstract class SpeechError extends Error {
  abstract readonly kind: SpeechErrorKind;
}

/** Azure Speech env (`AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`) is absent. */
export class SpeechNotConfiguredError extends SpeechError {
  readonly kind = "not_configured" as const;
  constructor(
    message = "Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.",
  ) {
    super(message);
    this.name = "SpeechNotConfiguredError";
  }
}

/** HTTP 401 — invalid subscription key or wrong regional endpoint. */
export class SpeechAuthError extends SpeechError {
  readonly kind = "auth" as const;
  readonly status = 401 as const;
  constructor(message = "Azure Speech rejected the subscription key (401).") {
    super(message);
    this.name = "SpeechAuthError";
  }
}

/** HTTP 429 — upstream rate limit exceeded. */
export class SpeechThrottledError extends SpeechError {
  readonly kind = "throttled" as const;
  readonly status = 429 as const;
  constructor(message = "Azure Speech request was throttled (429).") {
    super(message);
    this.name = "SpeechThrottledError";
  }
}

/** Any other non-2xx HTTP response (or a network/transport failure). */
export class SpeechRequestError extends SpeechError {
  readonly kind = "request" as const;
  constructor(
    message: string,
    /** Upstream HTTP status, when the failure was an HTTP response. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "SpeechRequestError";
  }
}

/** Recognition returned but was unusable (`RecognitionStatus !== "Success"`, empty NBest). */
export class SpeechRecognitionError extends SpeechError {
  readonly kind = "recognition" as const;
  constructor(
    message: string,
    /** The `RecognitionStatus` Azure reported (e.g. "NoMatch"). */
    readonly recognitionStatus?: string,
  ) {
    super(message);
    this.name = "SpeechRecognitionError";
  }
}

/**
 * Translate a non-2xx Azure HTTP response into the matching typed error.
 * `bodyText` is included only in the generic case (never contains our key).
 */
export function throwForHttpStatus(status: number, bodyText: string): never {
  if (status === 401) throw new SpeechAuthError();
  if (status === 429) throw new SpeechThrottledError();
  throw new SpeechRequestError(
    `Azure Speech request failed with status ${status}${bodyText ? `: ${bodyText}` : ""}`,
    status,
  );
}
