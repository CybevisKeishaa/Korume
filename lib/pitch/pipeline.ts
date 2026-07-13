/**
 * Shared samples→contour composition of the B1 pitch pipeline:
 * extractF0 → medianFilter → buildContour. Pure — used both for the user's
 * decoded recording (`pitch-contour.tsx`, pitch-accent comparison) and for
 * TTS reference audio decoded by `lib/audio/wav-decode.ts`.
 */
import { buildContour, medianFilter, medianVoicedHz } from "./contour";
import { extractF0 } from "./f0";
import type { PitchContour } from "./types";

/**
 * Run the full pitch pipeline on decoded mono samples. Returns `null` when
 * the clip has no voiced frames at all (silence/noise) — there is no baseline
 * and nothing meaningful to plot or compare.
 */
export function contourFromSamples(
  samples: Float32Array,
  sampleRate: number,
): PitchContour | null {
  const filtered = medianFilter(extractF0(samples, sampleRate));
  if (medianVoicedHz(filtered) === null) return null;
  return buildContour(filtered, sampleRate);
}
