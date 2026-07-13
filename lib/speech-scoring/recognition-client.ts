/**
 * Shared transport for the Azure short-audio recognition endpoint. Both plain
 * STT and pronunciation assessment POST audio here; assessment just adds the
 * `Pronunciation-Assessment` header. Kept separate so the two capabilities
 * don't duplicate fetch/error plumbing.
 */
import { recognitionEndpoint, speechCredentials } from "./config";
import { SpeechRequestError, throwForHttpStatus } from "./errors";
import type { SpeechAudioInput } from "./types";

/** Raw per-word entry from Azure's detailed recognition (assessment mode). */
export interface RawRecognizedWord {
  Word: string;
  PronunciationAssessment?: {
    AccuracyScore: number;
    ErrorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
  };
}

/** Raw NBest entry — pronunciation fields present only in assessment mode. */
export interface RawRecognitionNBest {
  Confidence?: number;
  Display?: string;
  PronunciationAssessment?: {
    AccuracyScore: number;
    FluencyScore: number;
    CompletenessScore: number;
    PronScore: number;
  };
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
    });
  } catch (err) {
    throw new SpeechRequestError(
      `Network error calling Azure Speech recognition: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!response.ok) throwForHttpStatus(response.status, await safeText(response));

  return (await response.json()) as RawRecognitionResponse;
}
