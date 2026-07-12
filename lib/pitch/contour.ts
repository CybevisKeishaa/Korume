/**
 * Presentation helpers for the pitch contour (task B2, `motion-engineer`).
 *
 * Rendering-agnostic: everything here returns plain numbers / data shapes — no
 * DOM, canvas, or SVG. The renderer decides pixels; this module decides the
 * *values* it plots.
 */
import type { F0Frame, PitchContour } from "./types";

/**
 * Convert an absolute frequency to a *relative* pitch in semitones against a
 * reference. Japanese pitch accent is about the contour's SHAPE (rise/fall
 * pattern), not absolute Hz — a speaker's register is irrelevant — so the
 * overlay should be drawn in semitones relative to, e.g., the user's own median
 * pitch. 12 semitones = one octave.
 *
 * @throws RangeError if `hz` or `refHz` is not positive (semitones are undefined).
 */
export function hzToSemitones(hz: number, refHz: number): number {
  if (!(hz > 0) || !(refHz > 0)) {
    throw new RangeError(`hzToSemitones requires positive hz/refHz, got hz=${hz} refHz=${refHz}`);
  }
  return 12 * Math.log2(hz / refHz);
}

/**
 * The median of the voiced frames' Hz values, or `null` if none are voiced.
 * A natural reference for `hzToSemitones` (a speaker-relative baseline).
 */
export function medianVoicedHz(frames: F0Frame[]): number | null {
  const voiced = frames
    .map((f) => f.hz)
    .filter((hz): hz is number => hz !== null)
    .sort((a, b) => a - b);
  if (voiced.length === 0) {
    return null;
  }
  const mid = Math.floor(voiced.length / 2);
  return voiced.length % 2 === 1
    ? (voiced[mid] as number)
    : ((voiced[mid - 1] as number) + (voiced[mid] as number)) / 2;
}

/**
 * Median-filter the F0 track to remove single-frame octave jumps / jitter while
 * preserving the contour shape (median is edge-preserving, unlike a mean).
 *
 * Voicing is preserved: an unvoiced (`null`) frame stays `null`; a voiced frame
 * is replaced by the median of the voiced Hz values within a centred window of
 * `windowSize` frames (itself included). If a voiced frame has no voiced
 * neighbours in range, its own value is kept.
 *
 * @param windowSize odd, >= 1. Even values are rounded up to the next odd.
 */
export function medianFilter(frames: F0Frame[], windowSize = 5): F0Frame[] {
  if (!(windowSize >= 1)) {
    throw new RangeError(`windowSize must be >= 1, got ${windowSize}`);
  }
  const w = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
  const half = Math.floor(w / 2);

  return frames.map((frame, i) => {
    if (frame.hz === null) {
      return { time: frame.time, hz: null };
    }
    const neighbours: number[] = [];
    for (let j = Math.max(0, i - half); j <= Math.min(frames.length - 1, i + half); j++) {
      const hz = frames[j]?.hz;
      if (hz !== null && hz !== undefined) {
        neighbours.push(hz);
      }
    }
    if (neighbours.length === 0) {
      return { time: frame.time, hz: frame.hz };
    }
    neighbours.sort((a, b) => a - b);
    const mid = Math.floor(neighbours.length / 2);
    const median =
      neighbours.length % 2 === 1
        ? (neighbours[mid] as number)
        : ((neighbours[mid - 1] as number) + (neighbours[mid] as number)) / 2;
    return { time: frame.time, hz: median };
  });
}

/**
 * Wrap a frame track into a {@link PitchContour} — the shape the renderer (B2)
 * consumes. Frames are defensively copied so callers can't mutate the source.
 *
 * @throws RangeError if `sampleRate` is not positive.
 */
export function buildContour(frames: F0Frame[], sampleRate: number): PitchContour {
  if (!(sampleRate > 0)) {
    throw new RangeError(`sampleRate must be > 0, got ${sampleRate}`);
  }
  return {
    frames: frames.map((f) => ({ time: f.time, hz: f.hz })),
    sampleRate,
  };
}
