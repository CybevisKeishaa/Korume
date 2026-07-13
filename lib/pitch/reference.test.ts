import { afterEach, describe, expect, it, vi } from "vitest";
import { makeToneBuffer } from "@/test/audio-fixtures";
import { encodeWavPCM16, floatTo16BitPCM } from "@/lib/audio/pcm-encode";
import { medianVoicedHz } from "./contour";
import { clearReferenceContourCache, fetchReferenceContour } from "./reference";

function toneWavBytes(freqHz: number): ArrayBuffer {
  return encodeWavPCM16(floatTo16BitPCM(makeToneBuffer(freqHz, 16000, 0.5)), 16000, 1);
}

function wavResponse(bytes: ArrayBuffer): Response {
  return {
    status: 200,
    ok: true,
    arrayBuffer: async () => bytes,
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return { status, ok: false } as unknown as Response;
}

describe("fetchReferenceContour", () => {
  afterEach(() => {
    clearReferenceContourCache();
    vi.unstubAllGlobals();
  });

  it("synthesizes the line as 16kHz PCM WAV and extracts its contour", async () => {
    const fetchMock = vi.fn(async () => wavResponse(toneWavBytes(150)));
    vi.stubGlobal("fetch", fetchMock);

    const contour = await fetchReferenceContour("こんにちは");

    expect(contour).not.toBeNull();
    const median = medianVoicedHz(contour!.frames);
    expect(median!).toBeGreaterThan(140);
    expect(median!).toBeLessThan(160);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/speech/tts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "こんにちは",
      format: "riff-16khz-16bit-mono-pcm",
    });
  });

  it("caches the contour per sentence — a repeat call does not refetch", async () => {
    const fetchMock = vi.fn(async () => wavResponse(toneWavBytes(150)));
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchReferenceContour("こんにちは");
    const second = await fetchReferenceContour("こんにちは");

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests for the same sentence", async () => {
    const fetchMock = vi.fn(async () => wavResponse(toneWavBytes(150)));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      fetchReferenceContour("こんにちは"),
      fetchReferenceContour("こんにちは"),
    ]);

    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when TTS isn't configured (503) and doesn't retry", async () => {
    const fetchMock = vi.fn(async () => errorResponse(503));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchReferenceContour("こんにちは")).toBeNull();
    expect(await fetchReferenceContour("こんにちは")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null on a network error but retries on the next call", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(wavResponse(toneWavBytes(150)));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchReferenceContour("こんにちは")).toBeNull();
    expect(await fetchReferenceContour("こんにちは")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
