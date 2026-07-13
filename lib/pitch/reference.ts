/**
 * Client-side reference contour for pitch-accent comparison (差別化 #1).
 *
 * The reference is NEVER YouTube audio (CLAUDE.md §2.1) — it's synthesized
 * from the transcript line TEXT via `/api/speech/tts` as 16kHz 16-bit mono
 * PCM WAV, decoded with the pure `decodeWavPCM16Mono`, and run through the
 * same F0 pipeline as the user's recording (`contourFromSamples`) so both
 * contours are directly comparable by `scorePitchAccent`.
 *
 * Contours are cached per sentence for the page's lifetime (a transcript
 * line's TTS audio is deterministic, and re-synthesizing on every take would
 * burn the 20 req/min TTS quota). A 503 ("not configured") is also cached —
 * retrying can't succeed until the server is reconfigured. Transient
 * failures (network errors, non-503 statuses, undecodable audio) resolve to
 * `null` but are NOT cached, so the next take retries.
 */
import { decodeWavPCM16Mono } from "@/lib/audio/wav-decode";
import { contourFromSamples } from "./pipeline";
import type { PitchContour } from "./types";

const TTS_ENDPOINT = "/api/speech/tts";
const TTS_WAV_FORMAT = "riff-16khz-16bit-mono-pcm";

/** `null` here means "known unavailable" (503) — cached, never refetched. */
const cache = new Map<string, PitchContour | null>();
const inFlight = new Map<string, Promise<PitchContour | null>>();

/**
 * Fetch (or return the cached) reference pitch contour for a transcript
 * line. Resolves `null` when no reference is available — callers degrade to
 * the user-only contour view, never crash (CLAUDE.md: Azure optional).
 */
export function fetchReferenceContour(text: string): Promise<PitchContour | null> {
  const cached = cache.get(text);
  if (cached !== undefined) return Promise.resolve(cached);

  const pending = inFlight.get(text);
  if (pending) return pending;

  const request = (async (): Promise<PitchContour | null> => {
    try {
      const res = await fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, format: TTS_WAV_FORMAT }),
      });
      if (res.status === 503) {
        cache.set(text, null);
        return null;
      }
      if (!res.ok) return null;

      const wav = decodeWavPCM16Mono(await res.arrayBuffer());
      const contour = contourFromSamples(wav.samples, wav.sampleRate);
      if (contour === null) return null; // fully unvoiced synthesis — treat as transient
      cache.set(text, contour);
      return contour;
    } catch {
      return null;
    } finally {
      inFlight.delete(text);
    }
  })();

  inFlight.set(text, request);
  return request;
}

/** Test hook: forget every cached/in-flight contour. */
export function clearReferenceContourCache(): void {
  cache.clear();
  inFlight.clear();
}
