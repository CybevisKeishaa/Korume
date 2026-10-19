// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postRecognition } from "./recognition-client";
import { SpeechRequestError, SpeechThrottledError, throwForHttpStatus } from "./errors";

beforeEach(() => {
  vi.stubEnv("SPEECH_PROVIDER", "azure"); vi.stubEnv("AZURE_SPEECH_KEY", "test-key"); vi.stubEnv("AZURE_SPEECH_REGION", "japaneast");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("recognition transport", () => {
  it("bounds a pending Azure request to 30 seconds and maps abort to request failure", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError")));
    }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = postRecognition(new Uint8Array([1]));
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    controller.abort(); await expect(pending).rejects.toBeInstanceOf(SpeechRequestError);
  });
  it("maps a timeout while reading the response body to a request failure", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => Promise.resolve(new Response(new ReadableStream({
      start(stream) { init?.signal?.addEventListener("abort", () => stream.error(new DOMException("timeout", "TimeoutError"))); },
    })))));
    const pending = postRecognition(new Uint8Array([1]));
    await Promise.resolve(); controller.abort();
    await expect(pending).rejects.toBeInstanceOf(SpeechRequestError);
  });
  it.each([
    ["12", 12_000], ["0", 0], ["1.5", null], ["-1", null], ["Infinity", null], ["garbage", null], [null, null],
    ["99999999999999999999999999999999999999999999", null],
    ["Sun, 18 Oct 2026 03:00:12 GMT", 12_000],
    ["Sun, 18 Oct 2026 02:00:00 GMT", 0], ["2026-10-18", null],
  ] as const)("preserves only a valid upstream Retry-After %s", async (header, expected) => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-18T03:00:00Z"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 429, headers: header === null ? {} : { "Retry-After": header } })));
    await expect(postRecognition(new Uint8Array([1]))).rejects.toMatchObject({ kind: "throttled", retryAfterMs: expected ?? undefined });
  });
  it("keeps existing message constructors and synthesis HTTP mapping compatible", () => {
    expect(new SpeechThrottledError("custom").message).toBe("custom");
    expect(() => throwForHttpStatus(429, "busy")).toThrow(SpeechThrottledError);
  });
});
