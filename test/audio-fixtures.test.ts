import { describe, expect, it } from "vitest";
import { makeToneBuffer, makeSilenceBuffer } from "./audio-fixtures";

describe("makeToneBuffer", () => {
  it("returns the expected sample count for the given duration", () => {
    const buf = makeToneBuffer(220, 16000, 0.5);
    expect(buf).toBeInstanceOf(Float32Array);
    expect(buf.length).toBe(8000);
  });

  it("matches the reference sine formula sample-for-sample", () => {
    const freqHz = 100;
    const sampleRate = 8000;
    const buf = makeToneBuffer(freqHz, sampleRate, 0.1);
    // toBeCloseTo precision 6: Float32Array storage only has ~7 significant
    // decimal digits, so exact (double-precision) equality isn't achievable.
    for (let i = 0; i < buf.length; i++) {
      const expected = Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
      expect(buf[i]).toBeCloseTo(expected, 6);
    }
  });

  it("is periodic at sampleRate/freqHz samples (deterministic, no FFT needed)", () => {
    const freqHz = 100;
    const sampleRate = 8000;
    const buf = makeToneBuffer(freqHz, sampleRate, 1);
    const samplesPerPeriod = sampleRate / freqHz; // 80, exact for this pair
    for (let i = 0; i < samplesPerPeriod; i++) {
      expect(buf[i + samplesPerPeriod]).toBeCloseTo(buf[i] as number, 6);
    }
  });

  it("starts at 0 (phase 0) and stays within [-1, 1]", () => {
    const buf = makeToneBuffer(440, 44100, 0.01);
    expect(buf[0]).toBeCloseTo(0, 10);
    for (const sample of buf) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it("rejects non-positive frequency or sample rate, and negative duration", () => {
    expect(() => makeToneBuffer(0, 16000, 1)).toThrow(RangeError);
    expect(() => makeToneBuffer(220, 0, 1)).toThrow(RangeError);
    expect(() => makeToneBuffer(220, 16000, -1)).toThrow(RangeError);
  });
});

describe("makeSilenceBuffer", () => {
  it("returns all-zero samples of the expected length", () => {
    const buf = makeSilenceBuffer(16000, 0.25);
    expect(buf.length).toBe(4000);
    expect(buf.every((s) => s === 0)).toBe(true);
  });
});
