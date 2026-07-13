import { describe, expect, it } from "vitest";
import {
  buildWav16kMono,
  downmixToMono,
  encodeWavPCM16,
  floatTo16BitPCM,
  resampleLinear,
  TARGET_SAMPLE_RATE,
} from "./pcm-encode";

describe("downmixToMono", () => {
  it("passes a single channel through unchanged", () => {
    const ch = new Float32Array([0.1, -0.2, 0.3]);
    expect(downmixToMono([ch])).toEqual(ch);
  });

  it("averages two channels sample-by-sample", () => {
    const left = new Float32Array([1, 1, 0]);
    const right = new Float32Array([-1, -1, 0]);
    expect(Array.from(downmixToMono([left, right]))).toEqual([0, 0, 0]);
  });

  it("returns an empty buffer for no channels", () => {
    expect(downmixToMono([]).length).toBe(0);
  });
});

describe("resampleLinear", () => {
  it("returns the input unchanged when rates match", () => {
    const input = new Float32Array([1, 2, 3, 4]);
    expect(Array.from(resampleLinear(input, 16000, 16000))).toEqual([1, 2, 3, 4]);
  });

  it("downsamples by an integer factor via linear interpolation", () => {
    const input = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const out = resampleLinear(input, 10, 5);
    expect(Array.from(out)).toEqual([0, 2, 4, 6, 8]);
  });

  it("upsamples via linear interpolation, clamping past the last sample", () => {
    const input = new Float32Array([0, 10]);
    const out = resampleLinear(input, 1, 2);
    expect(Array.from(out)).toEqual([0, 5, 10, 10]);
  });

  it("handles an empty input", () => {
    expect(resampleLinear(new Float32Array(0), 48000, 16000).length).toBe(0);
  });
});

describe("floatTo16BitPCM", () => {
  it("maps -1..1 to the full Int16 range", () => {
    const out = floatTo16BitPCM(new Float32Array([-1, 0, 1]));
    expect(Array.from(out)).toEqual([-32768, 0, 32767]);
  });

  it("clamps values outside -1..1", () => {
    const out = floatTo16BitPCM(new Float32Array([-2, 2]));
    expect(Array.from(out)).toEqual([-32768, 32767]);
  });
});

describe("encodeWavPCM16", () => {
  it("writes a valid RIFF/WAVE header matching the PCM payload", () => {
    const samples = new Int16Array([1, -1, 100, -100]);
    const buffer = encodeWavPCM16(samples, 16000, 1);
    const view = new DataView(buffer);
    const text = (offset: number, len: number) =>
      String.fromCharCode(...new Uint8Array(buffer, offset, len));

    expect(buffer.byteLength).toBe(44 + samples.length * 2);
    expect(text(0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16); // PCM fmt chunk size
    expect(view.getUint16(20, true)).toBe(1); // PCM format
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint32(28, true)).toBe(16000 * 1 * 2); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(samples.length * 2);

    for (let i = 0; i < samples.length; i++) {
      expect(view.getInt16(44 + i * 2, true)).toBe(samples[i]);
    }
  });
});

describe("buildWav16kMono", () => {
  it("composes downmix + resample + PCM16 + WAV header for mono input already at 16kHz", () => {
    const channel = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const buffer = buildWav16kMono([channel], TARGET_SAMPLE_RATE);
    expect(buffer.byteLength).toBe(44 + channel.length * 2);

    const view = new DataView(buffer);
    expect(view.getUint32(24, true)).toBe(TARGET_SAMPLE_RATE);
    expect(view.getUint16(22, true)).toBe(1);
  });

  it("downmixes stereo and resamples to 16kHz", () => {
    const left = new Float32Array(48000).fill(1);
    const right = new Float32Array(48000).fill(-1);
    const buffer = buildWav16kMono([left, right], 48000);
    const view = new DataView(buffer);

    // 48000 samples @48kHz downsampled to 16kHz -> ~16000 samples.
    const dataSize = view.getUint32(40, true);
    expect(dataSize / 2).toBeCloseTo(16000, -2);
    // Downmix of +1/-1 is 0 for every sample, regardless of resampling.
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(44 + dataSize - 2, true)).toBe(0);
  });
});
