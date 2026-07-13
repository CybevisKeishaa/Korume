import "server-only";
/**
 * Server-only Anthropic client factory. `import "server-only"` makes any
 * accidental client-bundle import a build error (CLAUDE.md §6 — API keys never
 * reach the browser). The key is read from `process.env.ANTHROPIC_API_KEY`;
 * when absent, callers get a typed {@link AiNotConfiguredError} and no request
 * is attempted.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AiNotConfiguredError } from "./errors";

/** Whether the Claude wrapper has an API key configured. */
export function isAiConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === "string" && key.length > 0;
}

/**
 * Returns a fresh Anthropic client, or throws {@link AiNotConfiguredError} if
 * no key is set. Constructed with the API key only — NO custom `fetch` option,
 * so the test harness's `globalThis.fetch` mock is exercised (a client-level
 * fetch override would silently bypass it).
 *
 * `maxRetries: 0` disables the SDK's built-in backoff-retry. These wrappers run
 * behind rate-limited routes (CLAUDE.md §6): the route/caller owns retry policy,
 * so we surface the typed error immediately instead of silently retrying (and
 * compounding latency) behind an already throttled endpoint.
 */
export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiNotConfiguredError();
  }
  return new Anthropic({ apiKey, maxRetries: 0 });
}
