/**
 * Pitch-accent scoring — 差別化 #1 (CLAUDE.md §5.1, spec §10.1).
 *
 * Compares the intonation SHAPE of the user's recording against a reference
 * contour and produces a 0–100 score for `shadowing_sessions.pitch_score` plus
 * aligned overlay data the `motion-engineer` renders (reference vs user).
 *
 * PURE MATH — no I/O, network, keys, audio decoding or DOM. Both inputs are
 * already-extracted {@link PitchContour} values:
 *   - the user's own recording (client-side F0, CLAUDE.md §2.2), and
 *   - the reference, extracted client-side from TTS audio of the transcript
 *     line TEXT (`speech-scoring.synthesizeSpeech`). YouTube audio is NEVER
 *     used as reference (CLAUDE.md §2.1).
 *
 * Method (deliberately simple; DTW intentionally avoided — see the brief):
 *   1. Speaker-relative normalization: each contour → semitones vs its OWN
 *      median voiced pitch (`hzToSemitones` / `medianVoicedHz`). This removes
 *      register differences, so a constant pitch shift between speakers does
 *      not affect the score.
 *   2. Time normalization: each contour's frame times are scaled to [0,1] and
 *      linearly resampled onto a shared grid of `resolution` points, so
 *      recordings of different lengths align.
 *   3. Voicing gate: only grid points voiced in BOTH contours are compared. If
 *      the voiced overlap is too small the result is flagged low-confidence
 *      with a zero score rather than a misleading number.
 *   4. Shape distance: a best-fit vertical offset is removed (making the score
 *      offset-invariant even when the two median baselines differ because of
 *      differing voicing), then the RMS semitone residual is mapped through a
 *      Gaussian to 0–100.
 */
import { hzToSemitones, medianVoicedHz } from "./contour";
import type { F0Frame, PitchContour } from "./types";

/** Number of points on the shared, time-normalized comparison grid. */
const DEFAULT_RESOLUTION = 64;

/**
 * RMS semitone residual that maps to ~60% of full score. Smaller = stricter.
 * ~1.5 st reflects that a couple of semitones of intonation error is clearly
 * audible and pedagogically meaningful in Japanese pitch accent.
 */
const SIGMA_SEMITONES = 1.5;

/**
 * Below this voiced-overlap fraction the comparison is untrustworthy: the score
 * is forced to 0 and `lowConfidence` is set.
 */
const MIN_VOICED_OVERLAP = 0.3;

/** Voiced-overlap fraction at (or above) which confidence is considered full. */
const FULL_CONFIDENCE_OVERLAP = 0.6;

export interface ScorePitchAccentOptions {
  /**
   * Number of points on the shared comparison grid (and the overlay length).
   * Must be an integer ≥ 2. Default 64.
   */
  resolution?: number;
}

/**
 * One aligned point of the reference-vs-user overlay, on the shared normalized
 * time axis. Semitone values are relative to each speaker's OWN median voiced
 * pitch; `null` where that speaker is unvoiced at this point.
 */
export interface PitchOverlayPoint {
  /** Normalized time in [0,1] (0 = line start, 1 = line end). */
  t: number;
  /** User pitch in semitones vs the user's median, or `null` if unvoiced. */
  userSemitones: number | null;
  /** Reference pitch in semitones vs the reference's median, or `null` if unvoiced. */
  refSemitones: number | null;
}

/**
 * Result of comparing a user contour to a reference contour.
 * `score` is safe to persist to `shadowing_sessions.pitch_score`.
 */
export interface PitchAccentScore {
  /** Overall intonation-shape similarity, 0–100 (100 = identical shape). */
  score: number;
  /** Fraction (0–1) of grid points voiced in BOTH contours. */
  voicedOverlap: number;
  /**
   * Trust in the score, 0–1: `voicedOverlap` scaled so that
   * ≥ {@link FULL_CONFIDENCE_OVERLAP} maps to 1.
   */
  confidence: number;
  /** True when `voicedOverlap` fell below the minimum and `score` was forced low. */
  lowConfidence: boolean;
  /** Aligned reference/user contour pair for the renderer (length = resolution). */
  overlay: PitchOverlayPoint[];
}

/** A normalized-time sample of a single contour: value is semitones or `null`. */
interface SemitonePoint {
  t: number;
  v: number | null;
}

/**
 * Score the user's intonation against a reference. Pure and deterministic.
 *
 * @throws RangeError if `resolution` is not an integer ≥ 2.
 */
export function scorePitchAccent(
  user: PitchContour,
  reference: PitchContour,
  opts: ScorePitchAccentOptions = {},
): PitchAccentScore {
  const resolution = opts.resolution ?? DEFAULT_RESOLUTION;
  if (!Number.isInteger(resolution) || resolution < 2) {
    throw new RangeError(`resolution must be an integer >= 2, got ${resolution}`);
  }

  const userPts = toSemitonePoints(user.frames);
  const refPts = toSemitonePoints(reference.frames);

  const userGrid = userPts ? resample(userPts, resolution) : nullGrid(resolution);
  const refGrid = refPts ? resample(refPts, resolution) : nullGrid(resolution);

  const overlay: PitchOverlayPoint[] = [];
  const paired: Array<{ u: number; r: number }> = [];
  for (let k = 0; k < resolution; k++) {
    const u = userGrid[k] ?? null;
    const r = refGrid[k] ?? null;
    overlay.push({ t: k / (resolution - 1), userSemitones: u, refSemitones: r });
    if (u !== null && r !== null) {
      paired.push({ u, r });
    }
  }

  const voicedOverlap = paired.length / resolution;
  const confidence = clamp01(voicedOverlap / FULL_CONFIDENCE_OVERLAP);
  const lowConfidence = voicedOverlap < MIN_VOICED_OVERLAP;

  if (paired.length === 0) {
    return { score: 0, voicedOverlap: 0, confidence: 0, lowConfidence: true, overlay };
  }

  // Best-fit vertical offset = mean residual; removing it makes the comparison
  // purely about shape and robust to baseline drift when voicing differs.
  let sumDiff = 0;
  for (const p of paired) {
    sumDiff += p.u - p.r;
  }
  const offset = sumDiff / paired.length;

  let sumSq = 0;
  for (const p of paired) {
    const d = p.u - p.r - offset;
    sumSq += d * d;
  }
  const rms = Math.sqrt(sumSq / paired.length);

  const raw = 100 * Math.exp(-0.5 * (rms / SIGMA_SEMITONES) ** 2);
  const score = lowConfidence ? 0 : Math.round(raw * 100) / 100;

  return { score, voicedOverlap, confidence, lowConfidence, overlay };
}

/**
 * Convert a frame track to normalized-time semitone points relative to the
 * speaker's own median voiced pitch. Returns `null` when the contour has no
 * voiced frames (no baseline, nothing to compare).
 */
function toSemitonePoints(frames: F0Frame[]): SemitonePoint[] | null {
  const baseline = medianVoicedHz(frames);
  if (baseline === null) {
    return null;
  }
  const t0 = (frames[0] as F0Frame).time;
  const tLast = (frames[frames.length - 1] as F0Frame).time;
  const span = tLast - t0;
  return frames.map((f) => ({
    t: span > 0 ? (f.time - t0) / span : 0,
    v: f.hz !== null && f.hz > 0 ? hzToSemitones(f.hz, baseline) : null,
  }));
}

/**
 * Linearly resample normalized-time points onto a uniform grid of `resolution`
 * points across [0,1]. A grid point is voiced only when both bracketing source
 * points are voiced (gaps stay gaps — no interpolation across unvoiced spans).
 */
function resample(pts: SemitonePoint[], resolution: number): (number | null)[] {
  const out: (number | null)[] = new Array(resolution).fill(null);
  if (pts.length === 1) {
    out.fill((pts[0] as SemitonePoint).v);
    return out;
  }
  let seg = 0;
  for (let k = 0; k < resolution; k++) {
    const tk = k / (resolution - 1);
    while (seg < pts.length - 2 && (pts[seg + 1] as SemitonePoint).t < tk) {
      seg++;
    }
    const a = pts[seg] as SemitonePoint;
    const b = pts[seg + 1] as SemitonePoint;
    if (tk <= a.t) {
      out[k] = a.v;
    } else if (tk >= b.t) {
      out[k] = b.v;
    } else if (a.v === null || b.v === null) {
      out[k] = null;
    } else {
      const f = (tk - a.t) / (b.t - a.t);
      out[k] = a.v + f * (b.v - a.v);
    }
  }
  return out;
}

function nullGrid(resolution: number): (number | null)[] {
  return new Array<number | null>(resolution).fill(null);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
