/**
 * Pure PCM/WAV encoding helpers — no browser APIs, fully unit-testable.
 *
 * Azure Speech's short-audio REST endpoint (`lib/speech-scoring`) accepts
 * WAV/PCM (16kHz mono) or OGG/Opus — NOT the `audio/webm;codecs=opus` that
 * `useRecorder`'s `MediaRecorder` produces. This module converts decoded
 * audio samples into that WAV shape; the browser-side decode step (which
 * needs `AudioContext`, not unit-testable this way) lives in
 * `./blob-to-wav.ts`.
 */

/** Azure's short-audio endpoint expects 16kHz mono. */
export const TARGET_SAMPLE_RATE = 16000;

/** Averages N channels down to one. A single channel is returned as-is. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0]!;

  const length = channels[0]!.length;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i] ?? 0;
    out[i] = sum / channels.length;
  }
  return out;
}

/**
 * Linear-interpolation resampler. Deterministic and dependency-free (no
 * `OfflineAudioContext`), so it works identically in the browser and under
 * Vitest/jsdom. Good enough for speech-recognition input — Azure doesn't need
 * broadcast-quality resampling.
 */
export function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (input.length === 0) return new Float32Array(0);
  if (fromRate === toRate) return input.slice();

  const outputLength = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outputLength);
  const step = fromRate / toRate;
  const lastIndex = input.length - 1;

  for (let i = 0; i < outputLength; i++) {
    const srcPos = i * step;
    const i0 = Math.min(Math.floor(srcPos), lastIndex);
    const i1 = Math.min(i0 + 1, lastIndex);
    const frac = srcPos - i0;
    out[i] = input[i0]! * (1 - frac) + input[i1]! * frac;
  }
  return out;
}

/** Converts -1..1 float samples to signed 16-bit PCM, clamping out-of-range values. */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function writeAsciiString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Wraps signed 16-bit PCM samples in a canonical 44-byte RIFF/WAVE header. */
export function encodeWavPCM16(
  samples: Int16Array,
  sampleRate: number,
  numChannels = 1,
): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAsciiString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, "WAVE");
  writeAsciiString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format: 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeAsciiString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += bytesPerSample) {
    view.setInt16(offset, samples[i]!, true);
  }
  return buffer;
}

/**
 * Composition used by `blob-to-wav.ts`: downmix → resample to 16kHz →
 * 16-bit PCM → WAV header. Pure (operates on already-decoded channel data),
 * so it's covered directly by unit tests without any `AudioContext` mock.
 */
export function buildWav16kMono(
  channels: Float32Array[],
  sourceSampleRate: number,
  targetSampleRate: number = TARGET_SAMPLE_RATE,
): ArrayBuffer {
  const mono = downmixToMono(channels);
  const resampled = resampleLinear(mono, sourceSampleRate, targetSampleRate);
  const pcm16 = floatTo16BitPCM(resampled);
  return encodeWavPCM16(pcm16, targetSampleRate, 1);
}
