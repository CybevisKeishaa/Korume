import { TARGET_SAMPLE_RATE } from "./pcm-encode";

/** Spec 2026-10-15 section 4.3: inspect uploaded RIFF bytes rather than Content-Type. */
export const WAV_MAX_BYTES = 1_100_000;
export const WAV_MAX_SECONDS = 31;
const BYTES_PER_SECOND = TARGET_SAMPLE_RATE * 2;

export type WavCheck =
  | { ok: true; durationSeconds: number }
  | { ok: false; reason: "empty" | "too_large" | "not_wav" | "bad_format" | "too_long" };

const tag = (bytes: Uint8Array, at: number): string =>
  String.fromCharCode(...bytes.subarray(at, at + 4));

export function inspectWav(bytes: Uint8Array): WavCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > WAV_MAX_BYTES) return { ok: false, reason: "too_large" };
  if (bytes.length < 12 || tag(bytes, 0) !== "RIFF" || tag(bytes, 8) !== "WAVE") {
    return { ok: false, reason: "not_wav" };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = view.getUint32(4, true) + 8;
  if (riffEnd < 12 || riffEnd !== bytes.length) return { ok: false, reason: "not_wav" };
  let formatOk: boolean | null = null;
  let durationSeconds: number | null = null;
  for (let at = 12; at < riffEnd;) {
    if (at + 8 > riffEnd) return { ok: false, reason: "not_wav" };
    const id = tag(bytes, at);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    const next = body + size + (size % 2);
    if (id === "data") {
      if (formatOk === null || durationSeconds !== null) return { ok: false, reason: "not_wav" };
      if (!formatOk) return { ok: false, reason: "bad_format" };
      const seconds = size / BYTES_PER_SECOND;
      // Preserve too_long precedence even when the claimed audio exceeds the available bytes.
      if (seconds > WAV_MAX_SECONDS) return { ok: false, reason: "too_long" };
      if (size === 0 || size % 2 !== 0) return { ok: false, reason: "bad_format" };
      durationSeconds = seconds;
    }
    if (next > riffEnd) return { ok: false, reason: "not_wav" };
    if (id === "fmt ") {
      if (formatOk !== null || size < 16) return { ok: false, reason: "not_wav" };
      const sampleRate = view.getUint32(body + 4, true);
      formatOk = view.getUint16(body, true) === 1
        && view.getUint16(body + 2, true) === 1
        && sampleRate === TARGET_SAMPLE_RATE
        && view.getUint32(body + 8, true) === sampleRate * 2
        && view.getUint16(body + 12, true) === 2
        && view.getUint16(body + 14, true) === 16;
    }
    at = next;
  }
  return durationSeconds === null
    ? { ok: false, reason: "not_wav" }
    : { ok: true, durationSeconds };
}
