import { describe, expect, it } from "vitest";
import { encodeWavPCM16, floatTo16BitPCM } from "./pcm-encode";
import { decodeWavPCM16Mono } from "./wav-decode";

describe("decodeWavPCM16Mono", () => {
  it("round-trips samples encoded by encodeWavPCM16", () => {
    const source = new Float32Array([0, 0.5, -0.5, 0.25, -1, 1]);
    const wav = encodeWavPCM16(floatTo16BitPCM(source), 16000, 1);

    const decoded = decodeWavPCM16Mono(wav);

    expect(decoded.sampleRate).toBe(16000);
    expect(decoded.samples.length).toBe(source.length);
    for (let i = 0; i < source.length; i++) {
      expect(decoded.samples[i]).toBeCloseTo(source[i]!, 3);
    }
  });

  it("reads the data chunk even when other chunks precede it", () => {
    // Canonical file, then splice a junk "LIST" chunk between fmt and data.
    const canonical = new Uint8Array(encodeWavPCM16(new Int16Array([1000, -1000]), 16000, 1));
    const junkBody = new Uint8Array([1, 2, 3, 4]);
    const spliced = new Uint8Array(canonical.length + 8 + junkBody.length);
    spliced.set(canonical.subarray(0, 36), 0); // RIFF header + fmt chunk
    spliced.set([0x4c, 0x49, 0x53, 0x54], 36); // "LIST"
    new DataView(spliced.buffer).setUint32(40, junkBody.length, true);
    spliced.set(junkBody, 44);
    spliced.set(canonical.subarray(36), 44 + junkBody.length); // data chunk
    new DataView(spliced.buffer).setUint32(4, spliced.length - 8, true); // fix RIFF size

    const decoded = decodeWavPCM16Mono(spliced.buffer);

    expect(decoded.sampleRate).toBe(16000);
    expect(decoded.samples.length).toBe(2);
    expect(decoded.samples[0]).toBeCloseTo(1000 / 0x7fff, 4);
  });

  it("rejects bytes that are not a RIFF/WAVE file", () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).buffer;
    expect(() => decodeWavPCM16Mono(junk)).toThrow(/not a .*wav/i);
  });

  it("rejects stereo WAV files", () => {
    const stereo = encodeWavPCM16(new Int16Array([0, 0, 0, 0]), 16000, 2);
    expect(() => decodeWavPCM16Mono(stereo)).toThrow(/mono/i);
  });

  it("clamps a data chunk whose declared size exceeds the actual bytes", () => {
    const wav = new Uint8Array(encodeWavPCM16(new Int16Array([100, 200, 300]), 16000, 1));
    new DataView(wav.buffer).setUint32(40, 9999, true); // lie about data size

    const decoded = decodeWavPCM16Mono(wav.buffer);
    expect(decoded.samples.length).toBe(3);
  });
});
