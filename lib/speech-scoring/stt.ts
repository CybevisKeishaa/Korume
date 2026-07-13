/**
 * Plain speech-to-text (ja-JP) for voice-conversation mode: STT → Claude → TTS
 * (CLAUDE.md §5.5). Same short-audio endpoint as assessment, minus the
 * `Pronunciation-Assessment` header. Transcripts are AI-generated and must be
 * labelled "may be wrong" at the UI (CLAUDE.md §3 / task constraints).
 */
import { SpeechRecognitionError } from "./errors";
import { postRecognition } from "./recognition-client";
import type { RecognizeSpeechParams, SpeechRecognitionResult } from "./types";

/** Transcribe a recording. Throws `SpeechRecognitionError` on NoMatch/empty. */
export async function recognizeSpeech(
  params: RecognizeSpeechParams,
): Promise<SpeechRecognitionResult> {
  const json = await postRecognition(params.audio);

  const best = json.NBest?.[0];
  if (json.RecognitionStatus !== "Success" || !best) {
    throw new SpeechRecognitionError(
      `Speech recognition returned no match (status: ${json.RecognitionStatus}).`,
      json.RecognitionStatus,
    );
  }

  return {
    text: json.DisplayText ?? best.Display ?? "",
    confidence: best.Confidence ?? 0,
  };
}
