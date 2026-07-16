/**
 * Server-only configuration for the Azure Cognitive Services Speech REST API.
 *
 * Keys NEVER reach the client (CLAUDE.md §6): this module reads
 * `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` from the server env and is only
 * imported by other server-side `lib/speech-scoring` modules.
 */
import { isSpeechEnabled } from "./env";
import { SpeechNotConfiguredError } from "./errors";

/** Recognition + synthesis language for the whole app (Japanese). */
export const SPEECH_LANGUAGE = "ja-JP";

const KEY_VAR = "AZURE_SPEECH_KEY";
const REGION_VAR = "AZURE_SPEECH_REGION";

/**
 * Whether Azure Speech is usable. Routes call this to return a clean 503 when
 * the feature is off, instead of throwing deep in a request. Never fakes creds.
 *
 * `isSpeechConfigured` used to infer "speech is on" from key presence. That
 * inference is what let an invalid AZURE_SPEECH_KEY (a resource id, not Key1)
 * sit live until the 2026-07-14 audit. Intent now comes from SPEECH_PROVIDER
 * (Spec D9); structure is validated at startup (see `./env`).
 */
export function isSpeechConfigured(): boolean {
  return isSpeechEnabled();
}

export interface SpeechCredentials {
  key: string;
  region: string;
}

/** Read creds or throw `SpeechNotConfiguredError`. Call this before any fetch. */
export function speechCredentials(): SpeechCredentials {
  const key = process.env[KEY_VAR];
  const region = process.env[REGION_VAR];
  if (!key || !region) throw new SpeechNotConfiguredError();
  return { key, region };
}

/** Short-audio recognition endpoint (STT + pronunciation assessment share it). */
export function recognitionEndpoint(region: string): string {
  return (
    `https://${region}.stt.speech.microsoft.com` +
    `/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${SPEECH_LANGUAGE}&format=detailed`
  );
}

/** Text-to-speech endpoint. */
export function ttsEndpoint(region: string): string {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}
