import { describe, expect, it } from "vitest";
import { scorePitchAccent } from "./score";
import type { F0Frame, PitchContour } from "./types";

const SAMPLE_RATE = 16000;

/**
 * Build a PitchContour from a per-frame Hz function. `hzAt` returns `null` for
 * unvoiced frames. Frames are evenly spaced `dt` seconds apart.
 */
function contour(
  n: number,
  hzAt: (i: number, n: number) => number | null,
  dt = 0.01,
): PitchContour {
  const frames: F0Frame[] = [];
  for (let i = 0; i < n; i++) {
    frames.push({ time: i * dt, hz: hzAt(i, n) });
  }
  return { frames, sampleRate: SAMPLE_RATE };
}

/** Linear Hz ramp from `from` to `to` across the contour. */
function ramp(from: number, to: number): (i: number, n: number) => number {
  return (i, n) => (n <= 1 ? from : from + ((to - from) * i) / (n - 1));
}

describe("scorePitchAccent — score behaviour", () => {
  it("scores identical contours 100 with full voiced overlap", () => {
    const c = contour(40, ramp(150, 250));
    const res = scorePitchAccent(c, structuredClone(c));
    expect(res.score).toBeCloseTo(100, 4);
    expect(res.voicedOverlap).toBe(1);
    expect(res.confidence).toBe(1);
    expect(res.lowConfidence).toBe(false);
    expect(Number.isFinite(res.score)).toBe(true);
  });

  it("is invariant to a constant register shift (different speaker pitch)", () => {
    // Same shape, user an octave-ish (×1.5 ≈ +7 st) below the reference.
    const ref = contour(40, ramp(180, 300));
    const user = contour(40, (i, n) => (ramp(180, 300)(i, n)) / 1.5);
    const res = scorePitchAccent(user, ref);
    expect(res.score).toBeGreaterThan(99);
  });

  it("scores a time-stretched copy of the same shape highly", () => {
    // Same normalized shape, different durations (50 vs 100 frames).
    const user = contour(50, ramp(150, 250));
    const ref = contour(100, ramp(150, 250));
    const res = scorePitchAccent(user, ref);
    expect(res.score).toBeGreaterThan(90);
    expect(res.lowConfidence).toBe(false);
  });

  it("scores a rising-vs-falling contour clearly low", () => {
    const rising = contour(40, ramp(150, 250));
    const falling = contour(40, ramp(250, 150));
    const res = scorePitchAccent(rising, falling);
    expect(res.score).toBeLessThan(10);
  });

  it("scores flat-vs-moving clearly low", () => {
    const flat = contour(40, () => 200);
    const moving = contour(40, ramp(150, 250));
    const res = scorePitchAccent(flat, moving);
    expect(res.score).toBeLessThan(40);
  });

  it("is monotonic: a closer shape scores higher than a farther one", () => {
    const ref = contour(40, ramp(150, 250));
    const close = scorePitchAccent(contour(40, ramp(150, 270)), ref).score;
    const far = scorePitchAccent(contour(40, ramp(150, 350)), ref).score;
    expect(close).toBeGreaterThan(far);
    expect(close).toBeLessThan(100);
  });
});

describe("scorePitchAccent — voicing & confidence", () => {
  it("returns a low-confidence, non-garbage result when voiced overlap is tiny", () => {
    // Only the first two frames are voiced; the rest are unvoiced gaps.
    const sparse = contour(20, (i) => (i < 2 ? 200 + i * 5 : null));
    const res = scorePitchAccent(sparse, structuredClone(sparse));
    expect(res.lowConfidence).toBe(true);
    expect(res.confidence).toBeLessThan(0.3);
    expect(res.score).toBeLessThan(20);
    expect(Number.isFinite(res.score)).toBe(true);
  });

  it("handles a fully unvoiced contour without NaN", () => {
    const silent = contour(20, () => null);
    const voiced = contour(20, ramp(150, 250));
    const res = scorePitchAccent(silent, voiced);
    expect(res.voicedOverlap).toBe(0);
    expect(res.score).toBe(0);
    expect(res.lowConfidence).toBe(true);
    expect(Number.isFinite(res.score)).toBe(true);
  });

  it("handles empty contours without NaN", () => {
    const empty: PitchContour = { frames: [], sampleRate: SAMPLE_RATE };
    const res = scorePitchAccent(empty, empty);
    expect(res.score).toBe(0);
    expect(res.voicedOverlap).toBe(0);
    expect(res.lowConfidence).toBe(true);
    expect(Number.isFinite(res.score)).toBe(true);
  });
});

describe("scorePitchAccent — overlay output for the renderer", () => {
  it("emits one overlay point per grid step with normalized time in [0,1]", () => {
    const c = contour(40, ramp(150, 250));
    const res = scorePitchAccent(c, structuredClone(c), { resolution: 32 });
    expect(res.overlay).toHaveLength(32);
    expect(res.overlay[0]?.t).toBe(0);
    expect(res.overlay[res.overlay.length - 1]?.t).toBe(1);
    for (const p of res.overlay) {
      expect(p.t).toBeGreaterThanOrEqual(0);
      expect(p.t).toBeLessThanOrEqual(1);
    }
  });

  it("overlays near-equal user/ref semitones for identical contours", () => {
    const c = contour(40, ramp(150, 250));
    const res = scorePitchAccent(c, structuredClone(c));
    const voiced = res.overlay.filter(
      (p) => p.userSemitones !== null && p.refSemitones !== null,
    );
    expect(voiced.length).toBeGreaterThan(0);
    for (const p of voiced) {
      expect(p.userSemitones).toBeCloseTo(p.refSemitones as number, 6);
    }
  });

  it("defaults to a 64-point overlay", () => {
    const c = contour(40, ramp(150, 250));
    const res = scorePitchAccent(c, structuredClone(c));
    expect(res.overlay).toHaveLength(64);
  });

  it("rejects a resolution below 2", () => {
    const c = contour(40, ramp(150, 250));
    expect(() => scorePitchAccent(c, c, { resolution: 1 })).toThrow(RangeError);
    expect(() => scorePitchAccent(c, c, { resolution: 2.5 })).toThrow(RangeError);
  });
});
