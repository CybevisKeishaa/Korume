/**
 * Fetch-level mock for Azure Cognitive Services Speech REST endpoints
 * (pronunciation assessment, plain STT, TTS), for deterministic, network-free
 * tests of `lib/speech-scoring`.
 *
 * Azure Speech has three distinct endpoint shapes hit from the same app
 * (recognition w/ `Pronunciation-Assessment` header, plain recognition, and
 * TTS returning binary audio), so — unlike the single-endpoint Claude mock —
 * this installs a small **router**: each `AzureRoute` matches requests by URL
 * substring/RegExp and serves its own FIFO response queue. Consistent with
 * `media-mocks.ts`/`youtube-stub.ts`: install/restore pair, fails loudly
 * instead of touching the real network (CLAUDE.md §7).
 *
 * Typical usage:
 *
 *   let azure: AzureSpeechMockHandle;
 *   afterEach(() => azure?.restore());
 *
 *   it("scores a pronunciation-assessment request", async () => {
 *     azure = installAzureSpeechMock([
 *       {
 *         match: /\/speech\/recognition\//,
 *         responses: [{ body: azurePronunciationAssessmentResult() }],
 *       },
 *     ]);
 *
 *     const result = await scorePronunciation(audioBlob, "今日はいい天気です");
 *
 *     expect(azure.calls[0]?.headers["pronunciation-assessment"]).toBeDefined();
 *     expect(result.pronScore).toBe(85);
 *   });
 */

/** One captured request the mock fetch received, in call order. */
export interface AzureCapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  /** Raw request body as text. Empty string for binary/absent bodies. */
  bodyText: string;
}

/** A canned response to hand back for the next request matching a route. */
export interface AzureQueuedResponse {
  /** HTTP status code. Defaults to 200. */
  status?: number;
  /**
   * Response body. `ArrayBuffer`/`ArrayBufferView` (e.g. from
   * `azureTtsAudioBuffer()`) is sent as raw binary; anything else is
   * JSON-serialized.
   */
  body: unknown;
  /** Extra/overriding response headers. */
  headers?: Record<string, string>;
}

export interface AzureRoute {
  /** Matches against the request URL. */
  match: string | RegExp;
  /** Canned responses for this route, consumed FIFO (one per matching call). */
  responses: AzureQueuedResponse[];
}

export interface AzureSpeechMockHandle {
  /** Every request the mock fetch received, in call order (across all routes). */
  calls: AzureCapturedRequest[];
  /** Restores whatever `globalThis.fetch` was before this mock was installed. */
  restore(): void;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

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

function matches(pattern: string | RegExp, url: string): boolean {
  return typeof pattern === "string" ? url.includes(pattern) : pattern.test(url);
}

/**
 * Narrows to the two binary shapes this mock actually produces (fixtures
 * build `ArrayBuffer`s directly; `Uint8Array` is accepted too in case a test
 * constructs one by hand). `Response`'s `BodyInit` union is narrower than
 * `ArrayBufferView` in general (it excludes views backed by
 * `SharedArrayBuffer`), so this checks the two concrete constructors rather
 * than the broader `ArrayBuffer.isView` guard.
 */
function isBinaryBody(body: unknown): body is ArrayBuffer | Uint8Array {
  return body instanceof ArrayBuffer || body instanceof Uint8Array;
}

/** Installs a mocked Azure Speech backend on `globalThis.fetch`, routed by URL. */
export function installAzureSpeechMock(routes: AzureRoute[]): AzureSpeechMockHandle {
  // Each route gets its own mutable queue copy so repeated installs in a
  // test file never share state across `installAzureSpeechMock` calls.
  const routeQueues = routes.map((route) => ({ ...route, responses: [...route.responses] }));
  const calls: AzureCapturedRequest[] = [];

  const globalWithFetch = globalThis as typeof globalThis & { fetch?: typeof fetch };
  const originalFetch = globalWithFetch.fetch;

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { url, method, headers, bodyText } = await resolveRequestInit(input, init);

    calls.push({ url, method, headers: headersToRecord(headers), bodyText });

    const route = routeQueues.find((candidate) => matches(candidate.match, url));
    if (!route) {
      throw new Error(
        `AzureSpeechMock: no route matches fetch to "${url}". ` +
          `Configured routes: ${routeQueues.map((r) => String(r.match)).join(", ") || "(none)"}. ` +
          `No real network calls are made.`,
      );
    }

    const next = route.responses.shift();
    if (!next) {
      throw new Error(
        `AzureSpeechMock: route ${String(route.match)} has no queued response left ` +
          `for request to "${url}".`,
      );
    }

    if (isBinaryBody(next.body)) {
      // `lib.dom.d.ts`'s `BodyInit` union doesn't line up with the generic
      // `ArrayBufferLike`-parameterized `Uint8Array`/`ArrayBuffer` types this
      // TS version infers for the fixtures, even though both are valid
      // `Response` bodies at runtime (per the Fetch spec) — narrow via a cast
      // rather than fighting the lib typing.
      return new Response(next.body as BodyInit, {
        status: next.status ?? 200,
        headers: { "content-type": "audio/mpeg", ...next.headers },
      });
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json", ...next.headers },
    });
  };

  globalWithFetch.fetch = fakeFetch as typeof fetch;

  return {
    calls,
    restore(): void {
      globalWithFetch.fetch = originalFetch;
    },
  };
}
