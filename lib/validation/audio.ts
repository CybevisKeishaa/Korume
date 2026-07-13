/**
 * Shared audio-upload size validation for the Layer 4 speech endpoints
 * (`/api/pronunciation/score`, `/api/speech/stt`). Both send raw WAV/PCM
 * bytes to Azure Speech, so both cap the same way — reject an oversized
 * upload before it ever reaches `lib/speech-scoring` (CLAUDE.md §6 — validate
 * every input).
 *
 * Structural (not a real `Blob`/`File`) so this is directly unit-testable —
 * see `audio.test.ts`.
 */

/** Azure's short-audio recognition endpoint is for a single spoken line —
 * 2MB comfortably covers several seconds of 16kHz mono PCM/WAV. */
export const MAX_SPEECH_AUDIO_BYTES = 2 * 1024 * 1024;

export interface AudioSizeLike {
  size: number;
}

export type AudioSizeValidation = { ok: true } | { ok: false; reason: "empty" | "too_large" };

/** Reject an empty or oversized audio upload before any network call. */
export function validateAudioSize(
  file: AudioSizeLike,
  maxBytes: number = MAX_SPEECH_AUDIO_BYTES,
): AudioSizeValidation {
  if (file.size === 0) return { ok: false, reason: "empty" };
  if (file.size > maxBytes) return { ok: false, reason: "too_large" };
  return { ok: true };
}
