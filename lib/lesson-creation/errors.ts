export class TransientLessonCreationProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TransientLessonCreationProviderError";
  }
}

/**
 * YouTube is refusing this server for now: HTTP 429, a captcha, or "confirm you
 * are not a bot". A fact about our IP rather than the video, and one that lasts
 * minutes, not milliseconds, so the worker waits longer before trying again.
 */
export class RateLimitedLessonCreationProviderError extends TransientLessonCreationProviderError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RateLimitedLessonCreationProviderError";
  }
}
