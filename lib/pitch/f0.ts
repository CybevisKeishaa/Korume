/**
 * F0 (fundamental-frequency / pitch) extraction — 差別化 #1 (CLAUDE.md §5.1,
 * spec §10.1).
 *
 * Pure, deterministic, client-capable: operates on raw mono PCM samples
 * (`Float32Array`, range ~[-1, 1]) and returns a per-frame pitch track. No I/O,
 * no network, no keys, no DOM — so it runs in the browser on the user's own
 * recording (CLAUDE.md §2.2) and is unit-testable in jsdom against synthetic
 * tones (see `@/test/audio-fixtures`).
 *
 * Algorithm: a simplified **YIN** estimator per sliding frame
 * (de Cheveigné & Kawahara, 2002):
 *   1. Difference function       d(τ)  = Σ (x[j] - x[j+τ])²
 *   2. Cumulative mean normalise d'(τ) = d(τ) / ((1/τ) Σ_{k≤τ} d(k)), d'(0)=1
 *   3. Absolute-threshold pick   first local min of d' that dips below a small
 *      threshold (this is what makes YIN robust against octave errors — it
 *      prefers the fundamental period over its multiples).
 *   4. Parabolic interpolation   refine the lag to sub-sample precision.
 * Voicing is decided from a clarity score (`1 - d'(bestLag)`): silence and
 * noise never produce a confident dip, so they fall out as `hz: null`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FUTURE SEAM (Layer 4 — NOT implemented here, do not stub with fake scores):
 *   Once reference pitch is available (TTS audio + accent data — CLAUDE.md §5,
 *   Layer 4; YouTube audio must NEVER be extracted, §2.1), pitch-accent scoring
 *   will live alongside this module as, roughly:
 *
 *     scorePitchAccent(user: PitchContour, reference: PitchContour): {
 *       score: number;                 // 0..1 intonation similarity
 *       alignment: Array<[ui: number, ri: number]>; // DTW frame pairing
 *     }
 *
 *   It would compare *shape* (semitone-relative, via `hzToSemitones`), align the
 *   two contours with DTW, and reduce the aligned distance to a score. Layer 3
 *   ships the user contour only — no reference exists yet, so no score is faked.
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { F0Frame } from "./types";

export interface ExtractF0Options {
  /** Analysis window length in samples. Must exceed the max lag (≈ sampleRate/minHz). */
  windowSize?: number;
  /** Step between successive frames in samples. Smaller = smoother, slower. */
  hopSize?: number;
  /** Lowest F0 to search for, Hz. Sets the max lag. Default 70 (low male speech). */
  minHz?: number;
  /** Highest F0 to search for, Hz. Sets the min lag. Default 400 (high female speech). */
  maxHz?: number;
  /**
   * Voicing/clarity threshold in [0, 1]. A frame is voiced only when its clarity
   * (`1 - d'(bestLag)`) is at least this value; otherwise `hz` is `null`.
   * Higher = stricter. Default 0.5.
   */
  voicingThreshold?: number;
}

const DEFAULTS = {
  windowSize: 1024,
  hopSize: 512,
  minHz: 70,
  maxHz: 400,
  voicingThreshold: 0.5,
} as const;

/** Below this per-frame RMS a frame is treated as silence (unvoiced). */
const SILENCE_RMS = 1e-4;
/**
 * YIN absolute threshold for the "first significant dip" step. Independent of
 * the (looser) voicing decision: it only guards against octave errors by
 * preferring the earliest confident period. 0.1 is the classic YIN value.
 */
const OCTAVE_THRESHOLD = 0.1;

/**
 * Extract a per-frame F0 track from mono PCM samples.
 *
 * @param samples    Mono audio in ~[-1, 1] (e.g. one channel of a decoded Blob).
 * @param sampleRate Samples per second (e.g. 48000).
 * @returns Ordered frames; `hz` is `null` for unvoiced frames. Empty array if
 *          the audio is too short to fit one analysis window.
 */
export function extractF0(
  samples: Float32Array,
  sampleRate: number,
  opts: ExtractF0Options = {},
): F0Frame[] {
  if (!(sampleRate > 0)) {
    throw new RangeError(`sampleRate must be > 0, got ${sampleRate}`);
  }

  const minHz = opts.minHz ?? DEFAULTS.minHz;
  const maxHz = opts.maxHz ?? DEFAULTS.maxHz;
  const hopSize = opts.hopSize ?? DEFAULTS.hopSize;
  const voicingThreshold = opts.voicingThreshold ?? DEFAULTS.voicingThreshold;

  if (!(minHz > 0) || !(maxHz > minHz)) {
    throw new RangeError(`require 0 < minHz < maxHz, got minHz=${minHz} maxHz=${maxHz}`);
  }
  if (!(hopSize > 0)) {
    throw new RangeError(`hopSize must be > 0, got ${hopSize}`);
  }

  const minLag = Math.max(1, Math.floor(sampleRate / maxHz));
  const maxLag = Math.ceil(sampleRate / minHz);

  // Window must be able to hold at least the longest period plus room for the
  // difference sum. Shrink to fit short clips; bail if even that is too short.
  const requested = opts.windowSize ?? DEFAULTS.windowSize;
  const windowSize = Math.min(requested, samples.length);
  if (windowSize <= maxLag + 1) {
    return [];
  }

  const frames: F0Frame[] = [];
  const lastStart = samples.length - windowSize;
  for (let start = 0; start <= lastStart; start += hopSize) {
    const hz = estimateFrameHz(
      samples,
      start,
      windowSize,
      sampleRate,
      minLag,
      maxLag,
      minHz,
      maxHz,
      voicingThreshold,
    );
    // Frame time is the window centre — the best single instant to attribute
    // this estimate to when a renderer plots it against the audio timeline.
    const time = (start + windowSize / 2) / sampleRate;
    frames.push({ time, hz });
  }
  return frames;
}

/**
 * YIN estimate for a single frame [start, start+windowSize). Returns the Hz of
 * the detected pitch, or `null` when the frame is silent/unvoiced or the pitch
 * falls outside [minHz, maxHz].
 */
function estimateFrameHz(
  samples: Float32Array,
  start: number,
  windowSize: number,
  sampleRate: number,
  minLag: number,
  maxLag: number,
  minHz: number,
  maxHz: number,
  voicingThreshold: number,
): number | null {
  // Number of terms in each difference sum; constant across lags so d(τ) values
  // are comparable. windowSize > maxLag is guaranteed by the caller.
  const searchLen = windowSize - maxLag;

  // Silence guard: without this, d'(τ) = 0/0 = NaN for an all-zero frame.
  let sumSq = 0;
  for (let i = 0; i < windowSize; i++) {
    const s = samples[start + i] as number;
    sumSq += s * s;
  }
  if (Math.sqrt(sumSq / windowSize) < SILENCE_RMS) {
    return null;
  }

  // Difference function d(τ) for τ in [0, maxLag].
  const d = new Float64Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < searchLen; j++) {
      const diff = (samples[start + j] as number) - (samples[start + j + tau] as number);
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // Cumulative mean normalised difference d'(τ).
  const dPrime = new Float64Array(maxLag + 1);
  dPrime[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    runningSum += d[tau] as number;
    dPrime[tau] = runningSum > 0 ? ((d[tau] as number) * tau) / runningSum : 1;
  }

  // Pick the lag: first local minimum dipping below OCTAVE_THRESHOLD (avoids
  // octave errors); else the global minimum over the search band.
  let bestLag = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if ((dPrime[tau] as number) < OCTAVE_THRESHOLD) {
      while (tau + 1 <= maxLag && (dPrime[tau + 1] as number) < (dPrime[tau] as number)) {
        tau++;
      }
      bestLag = tau;
      break;
    }
  }
  if (bestLag === -1) {
    let min = Infinity;
    for (let tau = minLag; tau <= maxLag; tau++) {
      if ((dPrime[tau] as number) < min) {
        min = dPrime[tau] as number;
        bestLag = tau;
      }
    }
  }

  const clarity = 1 - (dPrime[bestLag] as number);
  if (clarity < voicingThreshold) {
    return null;
  }

  const refinedLag = parabolicMinimum(dPrime, bestLag, maxLag);
  if (refinedLag <= 0) {
    return null;
  }
  const hz = sampleRate / refinedLag;
  // Reject estimates that landed outside the requested search band.
  if (hz < minHz || hz > maxHz) {
    return null;
  }
  return hz;
}

/**
 * Refine an integer lag to sub-sample precision by fitting a parabola through
 * d'(τ-1), d'(τ), d'(τ+1). Falls back to the integer lag at the edges or when
 * the curvature is degenerate.
 */
function parabolicMinimum(dPrime: Float64Array, tau: number, maxLag: number): number {
  if (tau <= 1 || tau >= maxLag) {
    return tau;
  }
  const a = dPrime[tau - 1] as number;
  const b = dPrime[tau] as number;
  const c = dPrime[tau + 1] as number;
  const denom = a - 2 * b + c;
  if (denom === 0) {
    return tau;
  }
  const shift = (a - c) / (2 * denom);
  // A well-formed local minimum yields |shift| < 1; clamp against pathologies.
  if (shift > 1 || shift < -1) {
    return tau;
  }
  return tau + shift;
}
