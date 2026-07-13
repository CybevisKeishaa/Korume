/**
 * Minimal 16-bit PCM mono WAV decoder — the inverse of `pcm-encode.ts`'s
 * `encodeWavPCM16`, and just as pure (no `AudioContext`, identical in the
 * browser and under Vitest).
 *
 * Exists for the pitch-accent reference pipeline: `/api/speech/tts` with
 * `format: "riff-16khz-16bit-mono-pcm"` returns exactly this shape, and
 * decoding it directly keeps reference-contour extraction deterministic
 * instead of routing TTS audio through `decodeAudioData`.
 */

export interface DecodedWav {
  /** Mono samples scaled to -1..1. */
  samples: Float32Array;
  sampleRate: number;
}

/** Reads the 4-byte ASCII tag at `offset`. */
function tagAt(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/**
 * Decode a 16-bit PCM mono RIFF/WAVE buffer. Scans chunks for `fmt ` and
 * `data` (tolerating extra chunks like `LIST`), and clamps a data chunk whose
 * declared size overruns the actual buffer.
 *
 * @throws Error when the buffer is not a RIFF/WAVE file, is not 16-bit PCM,
 * or is not mono.
 */
export function decodeWavPCM16Mono(buffer: ArrayBuffer): DecodedWav {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12 || tagAt(view, 0) !== "RIFF" || tagAt(view, 8) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE (.wav) file");
  }

  let sampleRate: number | null = null;
  let dataOffset: number | null = null;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const tag = tagAt(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (tag === "fmt ") {
      const audioFormat = view.getUint16(body, true);
      const numChannels = view.getUint16(body + 2, true);
      const bitsPerSample = view.getUint16(body + 14, true);
      if (audioFormat !== 1 || bitsPerSample !== 16) {
        throw new Error("Only 16-bit PCM WAV is supported");
      }
      if (numChannels !== 1) {
        throw new Error("Only mono WAV is supported");
      }
      sampleRate = view.getUint32(body + 4, true);
    } else if (tag === "data") {
      dataOffset = body;
      dataSize = Math.min(size, buffer.byteLength - body);
    }

    // Chunks are word-aligned: odd-sized chunks carry one padding byte.
    offset = body + size + (size % 2);
  }

  if (sampleRate === null || dataOffset === null) {
    throw new Error("Malformed WAV: missing fmt or data chunk");
  }

  const sampleCount = Math.floor(dataSize / 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = view.getInt16(dataOffset + i * 2, true) / 0x8000;
  }
  return { samples, sampleRate };
}
