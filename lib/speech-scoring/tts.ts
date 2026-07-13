/**
 * Text-to-speech (ja-JP). Two consumers:
 *   1. voice-conversation replies (Claude's text → spoken audio), and
 *   2. the REFERENCE audio for Layer 4 pitch-accent scoring — synthesized from
 *      transcript TEXT, NEVER extracted from YouTube (CLAUDE.md §2.1, absolute).
 *
 * Returns raw audio bytes; the caller streams/stores them (recordings storage
 * only, never video).
 */
import { speechCredentials, ttsEndpoint, SPEECH_LANGUAGE } from "./config";
import { SpeechRequestError, throwForHttpStatus } from "./errors";
import type { SynthesizeSpeechParams } from "./types";

/** Default Japanese female neural voice. */
export const DEFAULT_JA_VOICE = "ja-JP-NanamiNeural";

/** Default output format: 24kHz mono mp3 — small, browser-playable. */
export const DEFAULT_TTS_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

/** Escape text for safe inclusion in an SSML document (prevents markup injection). */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap text in a minimal ja-JP SSML document for the given voice. */
export function buildSsml(text: string, voice: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xml:lang="${SPEECH_LANGUAGE}">` +
    `<voice name="${voice}">${escapeXml(text)}</voice>` +
    `</speak>`
  );
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/** Synthesize `text` to audio bytes. Throws a typed `SpeechError` on failure. */
export async function synthesizeSpeech(params: SynthesizeSpeechParams): Promise<ArrayBuffer> {
  const { key, region } = speechCredentials();
  const voice = params.voice ?? DEFAULT_JA_VOICE;
  const format = params.format ?? DEFAULT_TTS_FORMAT;

  let response: Response;
  try {
    response = await fetch(ttsEndpoint(region), {
      method: "POST",
      headers: {
        "Content-Type": "application/ssml+xml",
        "Ocp-Apim-Subscription-Key": key,
        "X-Microsoft-OutputFormat": format,
        "User-Agent": "nihongo-cinema",
      },
      body: buildSsml(params.text, voice),
    });
  } catch (err) {
    throw new SpeechRequestError(
      `Network error calling Azure Speech TTS: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) throwForHttpStatus(response.status, await safeText(response));

  return response.arrayBuffer();
}
