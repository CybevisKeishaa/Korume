import { buildWav16kMono, TARGET_SAMPLE_RATE } from "./pcm-encode";
import { readBlobAsArrayBuffer } from "./read-blob";

/**
 * Converts a recorded `Blob` (the `audio/webm;codecs=opus` `useRecorder`
 * produces) into 16kHz mono 16-bit PCM WAV bytes — the format Azure Speech's
 * short-audio REST endpoint accepts (WAV/PCM or OGG/Opus; NOT webm/opus).
 *
 * Used only for the bytes POSTed to `/api/speech/stt` and
 * `/api/pronunciation/score` — never for what's stored in Supabase (that
 * stays the original webm blob from Layer 3's `ShadowingRecorderPanel`
 * upload path, untouched).
 *
 * Throws (rather than falling back to the original blob) when Web Audio is
 * unavailable or decoding fails — callers should catch this and show a
 * friendly "couldn't process that recording" message rather than send bytes
 * Azure can't parse.
 */
export async function blobToWav16kMono(blob: Blob): Promise<Blob> {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("Web Audio isn't available in this browser.");
  }

  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await readBlobAsArrayBuffer(blob);
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const channels: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    const wavBuffer = buildWav16kMono(channels, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    void ctx.close?.();
  }
}
