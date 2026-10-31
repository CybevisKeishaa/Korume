/**
 * Shared transport for the Azure short-audio recognition endpoint. Both plain
 * STT and pronunciation assessment POST audio here; assessment just adds the
 * `Pronunciation-Assessment` header. Kept separate so the two capabilities
 * don't duplicate fetch/error plumbing.
 */
import { recognitionEndpoint, speechCredentials } from "./config";
import { SpeechRequestError, SpeechThrottledError, throwForHttpStatus } from "./errors";
import type { SpeechAudioInput } from "./types";

interface RawWordScores {
  AccuracyScore: number;
  ErrorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
}

interface RawSentenceScores {
  AccuracyScore: number;
  FluencyScore: number;
  CompletenessScore: number;
  PronScore: number;
}

/**
 * Raw per-word entry from Azure's detailed recognition (assessment mode).
 * The REST short-audio endpoint puts scores FLAT on the word (verified live
 * 2026-10-31); the Speech SDK JSON nests them under `PronunciationAssessment`.
 */
export interface RawRecognizedWord extends Partial<RawWordScores> {
  Word: string;
  PronunciationAssessment?: RawWordScores;
}

/** Raw NBest entry — pronunciation fields present only in assessment mode (flat on REST, nested on SDK). */
export interface RawRecognitionNBest extends Partial<RawSentenceScores> {
  Confidence?: number;
  Display?: string;
  PronunciationAssessment?: RawSentenceScores;
  Words?: RawRecognizedWord[];
}

/** Raw detailed recognition response (shared by STT + assessment). */
export interface RawRecognitionResponse {
  RecognitionStatus: string;
  DisplayText?: string;
  NBest?: RawRecognitionNBest[];
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/** Azure accepts raw PCM/WAV bytes as the request body; both are valid at runtime. */
function toBodyInit(audio: SpeechAudioInput): BodyInit {
  return audio as BodyInit;
}

/**
 * POST audio to the recognition endpoint and return the parsed detailed body.
 * Throws a typed `SpeechError` for missing config, HTTP failures, or transport
 * errors. Does NOT interpret `RecognitionStatus` — callers decide what an
 * unusable recognition means for their result shape.
 */
export async function postRecognition(
  audio: SpeechAudioInput,
  assessmentHeader?: string,
): Promise<RawRecognitionResponse> {
  const { key, region } = speechCredentials();

  const headers: Record<string, string> = {
    "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
    "Ocp-Apim-Subscription-Key": key,
    Accept: "application/json",
  };
  if (assessmentHeader) headers["Pronunciation-Assessment"] = assessmentHeader;

  let response: Response;
  try {
    response = await fetch(recognitionEndpoint(region), {
      method: "POST",
      headers,
      body: toBodyInit(audio),
      signal: AbortSignal.timeout(SPEECH_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new SpeechRequestError(
      `Network error calling Azure Speech recognition: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (response.status === 429) throw new SpeechThrottledError(undefined, upstreamRetryAfter(response.headers.get("Retry-After")));
  if (!response.ok) throwForHttpStatus(response.status, await safeText(response));

  try {
    return (await response.json()) as RawRecognitionResponse;
  } catch {
    // Fetch resolves at headers; its signal can still abort a stalled body.
    throw new SpeechRequestError("Could not read Azure Speech recognition response.");
  }
}

export const SPEECH_REQUEST_TIMEOUT_MS = 30_000;
/** Retry-After is delta-seconds or an HTTP date; never invent a wait for an absent/invalid header. */
function upstreamRetryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  const header = value.trim();
  if (/^\d+$/.test(header)) {
    const ms = Number(header) * 1000;
    return Number.isSafeInteger(ms) ? ms : undefined;
  }
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(header)) return undefined;
  const date = Date.parse(header);
  if (!Number.isFinite(date) || new Date(date).toUTCString() !== header) return undefined;
  return Math.max(0, date - Date.now());
}
