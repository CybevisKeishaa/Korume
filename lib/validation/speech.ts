import { z } from "zod";
import { DEFAULT_TTS_FORMAT } from "@/lib/speech-scoring";

/**
 * Output formats the TTS route allows. `DEFAULT_TTS_FORMAT` (24kHz mp3) is
 * for playback; `riff-16khz-16bit-mono-pcm` is 16kHz mono PCM WAV, which the
 * client-side pitch pipeline (`lib/pitch`) needs for clean F0 extraction from
 * synthesized reference audio.
 */
export const TTS_FORMATS = [DEFAULT_TTS_FORMAT, "riff-16khz-16bit-mono-pcm"] as const;
export type TtsFormat = (typeof TTS_FORMATS)[number];

/** POST /api/speech/tts body. */
export const ttsRequestSchema = z.object({
  text: z.string().trim().min(1, "Text is required.").max(300, "Text is too long (max 300 characters)."),
  voice: z.string().min(1).max(100).optional(),
  format: z.enum(TTS_FORMATS).optional(),
});
export type TtsRequestInput = z.infer<typeof ttsRequestSchema>;

const FORMAT_CONTENT_TYPES: Record<string, string> = {
  [DEFAULT_TTS_FORMAT]: "audio/mpeg",
  "riff-16khz-16bit-mono-pcm": "audio/wav",
};

/** Maps a requested Azure output format to the HTTP `Content-Type` the TTS
 * route should send back. Falls back to mp3's content type for an unlisted
 * format (schema validation already rejects anything not in `TTS_FORMATS`,
 * so this is just a safe default, never actually hit in practice). */
export function contentTypeForFormat(format: string | undefined): string {
  if (!format) return FORMAT_CONTENT_TYPES[DEFAULT_TTS_FORMAT] as string;
  return FORMAT_CONTENT_TYPES[format] ?? (FORMAT_CONTENT_TYPES[DEFAULT_TTS_FORMAT] as string);
}
