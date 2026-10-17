import { describe, expect, it } from "vitest";
import { encodeWavPCM16, floatTo16BitPCM } from "./pcm-encode";
import { inspectWav, WAV_MAX_BYTES } from "./wav-header";

const wav = (seconds: number, rate = 16000, channels = 1) =>
  new Uint8Array(encodeWavPCM16(
    floatTo16BitPCM(new Float32Array(Math.round(seconds * rate) * channels)), rate, channels,
  ));
const viewOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

// Insert one odd-sized metadata chunk and its required padding before the data chunk.
function withMetadata(bytes: Uint8Array): Uint8Array {
  const result = new Uint8Array(bytes.length + 10);
  result.set(bytes.subarray(0, 36));
  result.set(new TextEncoder().encode("JUNK"), 36);
  viewOf(result).setUint32(40, 1, true);
  result[44] = 7;
  result.set(bytes.subarray(36), 46);
  viewOf(result).setUint32(4, result.length - 8, true);
  return result;
}

describe("inspectWav", () => {
  it("accepts 16 kHz mono 16-bit PCM and reports its duration", () => {
    expect(inspectWav(wav(2))).toEqual({ ok: true, durationSeconds: 2 });
  });

  it("accepts exactly 31 seconds", () => {
    expect(inspectWav(wav(31))).toEqual({ ok: true, durationSeconds: 31 });
  });

  it("rejects empty, non-RIFF and non-WAVE bytes", () => {
    expect(inspectWav(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
    expect(inspectWav(new TextEncoder().encode("OggS not a wav file at all")))
      .toEqual({ ok: false, reason: "not_wav" });
    const bytes = wav(1);
    bytes.set(new TextEncoder().encode("AVI "), 8);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "not_wav" });
  });

  it("rejects stereo, 44.1 kHz and non-PCM", () => {
    expect(inspectWav(wav(1, 16000, 2))).toEqual({ ok: false, reason: "bad_format" });
    expect(inspectWav(wav(1, 44100))).toEqual({ ok: false, reason: "bad_format" });
    const bytes = wav(1);
    bytes[20] = 3;
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "bad_format" });
  });

  it.each([[34, 8], [28, 16000], [32, 1]])("rejects inconsistent PCM field at %i", (offset, value) => {
    const bytes = wav(1);
    if (offset === 28) viewOf(bytes).setUint32(offset, value, true);
    else viewOf(bytes).setUint16(offset, value, true);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "bad_format" });
  });

  it("rejects more than 31 seconds and more than the byte cap", () => {
    expect(inspectWav(wav(31.5))).toEqual({ ok: false, reason: "too_long" });
    expect(inspectWav(new Uint8Array(WAV_MAX_BYTES + 1))).toEqual({ ok: false, reason: "too_large" });
  });

  it("prioritizes too_long for a data chunk claiming 40 seconds", () => {
    const bytes = wav(1);
    viewOf(bytes).setUint32(40, 16000 * 2 * 40, true);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "too_long" });
  });

  it("rejects a truncated header", () => {
    expect(inspectWav(wav(1).slice(0, 30))).toEqual({ ok: false, reason: "not_wav" });
  });

  it("rejects a truncated data payload under the duration cap", () => {
    const bytes = wav(1);
    viewOf(bytes).setUint32(40, 64000, true);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "not_wav" });
  });

  it("rejects empty audio and partial 16-bit samples", () => {
    expect(inspectWav(wav(0))).toEqual({ ok: false, reason: "bad_format" });
    const bytes = wav(1);
    viewOf(bytes).setUint32(40, 31999, true);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "bad_format" });
  });

  it.each([0, 14, 64000])("rejects invalid fmt chunk size %i", (size) => {
    const bytes = wav(1);
    viewOf(bytes).setUint32(16, size, true);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "not_wav" });
  });

  it("does not read missing fmt fields from a following chunk", () => {
    const canonical = wav(1);
    const bytes = new Uint8Array(canonical.length + 6);
    bytes.set(canonical.subarray(0, 34));
    viewOf(bytes).setUint32(16, 14, true);
    // The next chunk's ID starts with 16, imitating the absent bits-per-sample field.
    bytes[34] = 16;
    bytes.set(canonical.subarray(36), 42);
    viewOf(bytes).setUint32(4, bytes.length - 8, true);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "not_wav" });
  });

  it("accepts a padded metadata chunk and a Uint8Array with a nonzero byte offset", () => {
    const bytes = withMetadata(wav(1));
    const enclosing = new Uint8Array(bytes.length + 9);
    enclosing.set(bytes, 5);
    expect(inspectWav(enclosing.subarray(5, 5 + bytes.length)))
      .toEqual({ ok: true, durationSeconds: 1 });
  });

  it("rejects a metadata chunk extending beyond the RIFF body", () => {
    const bytes = withMetadata(wav(1));
    viewOf(bytes).setUint32(40, bytes.length, true);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "not_wav" });
  });

  it.each([4, 36, 64000])("rejects invalid RIFF body size %i", (size) => {
    const bytes = wav(1);
    viewOf(bytes).setUint32(4, size, true);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "not_wav" });
  });

  it("requires fmt before data and requires a data chunk", () => {
    const bytes = wav(1);
    bytes.set(new TextEncoder().encode("JUNK"), 12);
    expect(inspectWav(bytes)).toEqual({ ok: false, reason: "not_wav" });
    const noData = wav(1);
    noData.set(new TextEncoder().encode("JUNK"), 36);
    expect(inspectWav(noData)).toEqual({ ok: false, reason: "not_wav" });
  });
});
