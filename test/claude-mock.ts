/**
 * Fetch-level mock for the Anthropic Messages API (`POST /v1/messages`),
 * for deterministic, network-free tests of `lib/ai`.
 *
 * `lib/ai` is server-only and not yet written. As of this harness, the repo
 * has no `@anthropic-ai/sdk` dependency (see package.json) — the official SDK
 * calls the platform `fetch` under the hood by default (Node 18+ global
 * fetch), and only bypasses it if the client is constructed with an explicit
 * `fetch` override. Mocking at the `fetch` level therefore works transparently
 * whether `lib/ai` calls `fetch("https://api.anthropic.com/v1/messages", ...)`
 * directly or goes through `new Anthropic().messages.create(...)` — as long
 * as the Anthropic client is NOT constructed with a custom `fetch` option
 * pointing elsewhere. If `lib/ai` adds the SDK later, this is the one
 * constraint it must respect for these mocks to keep working.
 *
 * Typical usage:
 *
 *   let claude: ClaudeMockHandle;
 *   afterEach(() => claude?.restore());
 *
 *   it("sends the configured system prompt and model", async () => {
 *     claude = installClaudeMock({
 *       responses: [{ body: claudeTextResponse("こんにちは") }],
 *     });
 *
 *     const result = await generateReply("hello");
 *
 *     expect(claude.calls).toHaveLength(1);
 *     expect(claude.calls[0]?.body.model).toBe("claude-opus-4-8");
 *     expect(result).toContain("こんにちは");
 *   });
 *
 * No response in the queue when a request arrives, or a request to a
 * non-matching URL, throws immediately rather than falling through to a real
 * network call (CLAUDE.md §7 — no real network, ever; fail loudly instead of
 * hanging or flaking).
 */

/** Minimal shape of a `POST /v1/messages` request body — enough for assertions. */
export interface ClaudeMessagesRequestBody {
  model: string;
  system?: string | Array<{ type: "text"; text: string; [key: string]: unknown }>;
  messages: Array<{ role: "user" | "assistant"; content: unknown }>;
  max_tokens: number;
  tools?: unknown[];
  // Other request fields (thinking, output_config, tool_choice, ...) are
  // passed through untyped here; callers can index them if a test needs to
  // assert on one — this interface only pins down the fields the task calls
  // out (model, system, messages, max_tokens).
  [key: string]: unknown;
}

/** One captured request the mock fetch received, in call order. */
export interface ClaudeCapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: ClaudeMessagesRequestBody;
}

/** A canned response to hand back for the next matching request. */
export interface QueuedClaudeResponse {
  /** HTTP status code. Defaults to 200. */
  status?: number;
  /** JSON-serializable response body (a `ClaudeMessageResponse` or `ClaudeErrorBody`). */
  body: unknown;
  /** Extra response headers to set alongside `content-type: application/json`. */
  headers?: Record<string, string>;
}

export interface ClaudeMockOptions {
  /** Canned responses consumed in FIFO order, one per request. */
  responses?: QueuedClaudeResponse[];
  /**
   * URL pattern that must match for the mock to handle the request; any
   * other URL throws instead of hitting the network. Defaults to matching
   * any URL whose path ends in `/v1/messages` (optionally with a query
   * string), which covers both the real Anthropic host and a test double.
   */
  urlPattern?: RegExp;
}

export interface ClaudeMockHandle {
  /** Every request the mock fetch received, in call order. */
  calls: ClaudeCapturedRequest[];
  /** Adds another canned response to the end of the queue. */
  enqueue(response: QueuedClaudeResponse): void;
  /** Restores whatever `globalThis.fetch` was before this mock was installed. */
  restore(): void;
}

const DEFAULT_URL_PATTERN = /\/v1\/messages(?:\?.*)?$/;

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

/**
 * Normalizes fetch's two call shapes — `fetch(url, init)` and
 * `fetch(new Request(url, init))` — into a single `{url, method, headers,
 * bodyText}` shape. The Stainless-generated Anthropic SDKs use the first
 * shape; this also supports the second in case `lib/ai` (or a future
 * refactor) builds a `Request` explicitly.
 */
async function resolveRequestInit(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<{ url: string; method: string; headers: Headers; bodyText: string }> {
  if (typeof input === "string" || input instanceof URL) {
    const url = input.toString();
    const headers = new Headers(init?.headers);
    const method = init?.method ?? "GET";
    const rawBody = init?.body;
    const bodyText = typeof rawBody === "string" ? rawBody : rawBody ? String(rawBody) : "";
    return { url, method, headers, bodyText };
  }
  const request = input;
  const bodyText = await request.clone().text();
  return { url: request.url, method: request.method, headers: request.headers, bodyText };
}

/** Installs a mocked Claude (Anthropic Messages API) backend on `globalThis.fetch`. */
export function installClaudeMock(options: ClaudeMockOptions = {}): ClaudeMockHandle {
  const pattern = options.urlPattern ?? DEFAULT_URL_PATTERN;
  const queue: QueuedClaudeResponse[] = [...(options.responses ?? [])];
  const calls: ClaudeCapturedRequest[] = [];

  const globalWithFetch = globalThis as typeof globalThis & { fetch?: typeof fetch };
  const originalFetch = globalWithFetch.fetch;

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { url, method, headers, bodyText } = await resolveRequestInit(input, init);

    if (!pattern.test(url)) {
      throw new Error(
        `ClaudeMock: unexpected fetch to a non-matching URL: "${url}". ` +
          `Only requests matching ${pattern} are handled — no real network calls are made.`,
      );
    }

    let body: ClaudeMessagesRequestBody;
    try {
      body = JSON.parse(bodyText) as ClaudeMessagesRequestBody;
    } catch {
      throw new Error(
        `ClaudeMock: request body was not valid JSON (got: ${JSON.stringify(bodyText)}).`,
      );
    }

    calls.push({ url, method, headers: headersToRecord(headers), body });

    const next = queue.shift();
    if (!next) {
      throw new Error(
        `ClaudeMock: no queued response for request #${calls.length} to ${url}. ` +
          `Call enqueue() before making more requests than were queued at install time.`,
      );
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json", ...next.headers },
    });
  };

  globalWithFetch.fetch = fakeFetch as typeof fetch;

  return {
    calls,
    enqueue(response: QueuedClaudeResponse): void {
      queue.push(response);
    },
    restore(): void {
      globalWithFetch.fetch = originalFetch;
    },
  };
}
