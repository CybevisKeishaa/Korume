import { describe, expect, it } from "vitest";
import { extractF0 } from "./f0";
import { makeToneBuffer, makeSilenceBuffer } from "@/test/audio-fixtures";
import type { F0Frame } from "./types";

/** Median of the voiced Hz estimates across all frames (ignores unvoiced). */
function medianHz(frames: F0Frame[]): number {
  const voiced = frames
    .map((f) => f.hz)
    .filter((hz): hz is number => hz !== null)
    .sort((a, b) => a - b);
  if (voiced.length === 0) return NaN;
  return voiced[Math.floor(voiced.length / 2)] as number;
}

function fractionVoiced(frames: F0Frame[]): number {
  if (frames.length === 0) return 0;
  return frames.filter((f) => f.hz !== null).length / frames.length;
}

describe("extractF0 — recovers known tone frequencies", () => {
  const SAMPLE_RATE = 16000;

  it("recovers 100 Hz within ±5%", () => {
    const frames = extractF0(makeToneBuffer(100, SAMPLE_RATE, 0.5), SAMPLE_RATE);
    expect(frames.length).toBeGreaterThan(0);
    expect(fractionVoiced(frames)).toBeGreaterThan(0.9);
    expect(medianHz(frames)).toBeCloseTo(100, 0); // and asserted tighter below
    expect(Math.abs(medianHz(frames) - 100) / 100).toBeLessThanOrEqual(0.05);
  });

  it("recovers 200 Hz within ±5%", () => {
    const frames = extractF0(makeToneBuffer(200, SAMPLE_RATE, 0.5), SAMPLE_RATE);
    expect(fractionVoiced(frames)).toBeGreaterThan(0.9);
    expect(Math.abs(medianHz(frames) - 200) / 200).toBeLessThanOrEqual(0.05);
  });

  it("recovers 440 Hz within ±5% (widened maxHz above the speech default)", () => {
    // 440 Hz sits above the default 400 Hz speech ceiling, so widen the search
    // band — this also exercises the maxHz option.
    const frames = extractF0(makeToneBuffer(440, SAMPLE_RATE, 0.5), SAMPLE_RATE, { maxHz: 600 });
    expect(fractionVoiced(frames)).toBeGreaterThan(0.9);
    expect(Math.abs(medianHz(frames) - 440) / 440).toBeLessThanOrEqual(0.05);
  });

  it("recovers a mid-range tone at a different sample rate (48 kHz, 150 Hz)", () => {
    const frames = extractF0(makeToneBuffer(150, 48000, 0.3), 48000);
    expect(fractionVoiced(frames)).toBeGreaterThan(0.9);
    expect(Math.abs(medianHz(frames) - 150) / 150).toBeLessThanOrEqual(0.05);
  });
});

describe("extractF0 — unvoiced / silence", () => {
  it("marks silence as unvoiced (all hz null)", () => {
    const frames = extractF0(makeSilenceBuffer(16000, 0.5), 16000);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((f) => f.hz === null)).toBe(true);
  });

  it("is mostly unvoiced for a tone below the search band (30 Hz vs 70–400)", () => {
    // Fundamental (30 Hz) is below minHz, so no in-band period should score as
    // confidently voiced.
    const frames = extractF0(makeToneBuffer(30, 16000, 0.5), 16000);
    expect(fractionVoiced(frames)).toBeLessThan(0.2);
  });
});

describe("extractF0 — tracks a change over time", () => {
  it("follows a two-segment buffer (150 Hz then 300 Hz)", () => {
    const sr = 16000;
    const a = makeToneBuffer(150, sr, 0.4);
    const b = makeToneBuffer(300, sr, 0.4);
    const joined = new Float32Array(a.length + b.length);
    joined.set(a, 0);
    joined.set(b, a.length);

    const frames = extractF0(joined, sr);
    const boundaryTime = a.length / sr;

    // Frames comfortably inside each segment (avoid the transition window).
    const firstHalf = frames.filter((f) => f.time < boundaryTime - 0.05 && f.hz !== null);
    const secondHalf = frames.filter((f) => f.time > boundaryTime + 0.05 && f.hz !== null);

    expect(firstHalf.length).toBeGreaterThan(0);
    expect(secondHalf.length).toBeGreaterThan(0);
    expect(Math.abs(medianHz(firstHalf) - 150) / 150).toBeLessThanOrEqual(0.05);
    expect(Math.abs(medianHz(secondHalf) - 300) / 300).toBeLessThanOrEqual(0.05);
  });
});

describe("extractF0 — frame metadata & determinism", () => {
  const sr = 16000;

  it("emits frames with monotonically increasing centre times", () => {
    const frames = extractF0(makeToneBuffer(120, sr, 0.4), sr);
    for (let i = 1; i < frames.length; i++) {
      expect((frames[i] as F0Frame).time).toBeGreaterThan((frames[i - 1] as F0Frame).time);
    }
    expect((frames[0] as F0Frame).time).toBeGreaterThan(0); // centre of first window
  });

  it("is deterministic across repeated calls", () => {
    const buf = makeToneBuffer(180, sr, 0.3);
    expect(extractF0(buf, sr)).toEqual(extractF0(buf, sr));
  });

  it("returns an empty array when the clip is too short for one window", () => {
    const frames = extractF0(makeToneBuffer(200, sr, 0.001), sr); // 16 samples
    expect(frames).toEqual([]);
  });

  it("rejects invalid arguments", () => {
    expect(() => extractF0(makeToneBuffer(200, sr, 0.1), 0)).toThrow(RangeError);
    expect(() => extractF0(makeToneBuffer(200, sr, 0.1), sr, { minHz: 400, maxHz: 100 })).toThrow(
      RangeError,
    );
    expect(() => extractF0(makeToneBuffer(200, sr, 0.1), sr, { hopSize: 0 })).toThrow(RangeError);
  });
});
