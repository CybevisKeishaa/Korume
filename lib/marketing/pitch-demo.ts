import type { PitchContour } from "@/lib/pitch";

/**
 * The two contours drawn by the landing page's §4 showcase.
 *
 * ⚠️ THESE NUMBERS ARE ILLUSTRATIVE DESIGN MOCK DATA, NOT MEASUREMENT. So are
 * §4's four sub-scores (Pitch 86 · Rhythm 84 · Pronunciation 82 · Timing 90) and
 * its Overall Score of 87, which live in the copy catalog. They illustrate what
 * the feature shows a user. They are NOT a claim about scoring accuracy, NOT a
 * benchmark, and NOT a target. Nothing may derive a threshold from them.
 *
 * They are shaped like 日本の秋はとても美しいですね。 — a gentle rise across
 * 日本の秋, a peak on とても, and a fall through 美しいですね, with an unvoiced
 * gap at the phrase break. The "You" track follows the same phrase but flattens
 * the peak, which is exactly the error the real scorer is built to surface.
 *
 * Fix round 1: this warning used to sit only above `FRAME_INTERVAL_SECONDS`,
 * so hovering either exported contour below showed nothing. Each export below
 * now carries its own one-line pointer back to this block.
 */
const FRAME_INTERVAL_SECONDS = 0.01;

function toContour(hz: readonly (number | null)[]): PitchContour {
  return {
    frames: hz.map((value, i) => ({ time: i * FRAME_INTERVAL_SECONDS, hz: value })),
    sampleRate: 16000,
  };
}

/**
 * A speaker-relative baseline, the same quantity `medianVoicedHz` would
 * return. Illustrative mock data, not a measurement — see the file header.
 */
export const DEMO_REF_HZ = 180;

const NATIVE_HZ = [
  168, 170, 173, 177, 181, 186, 190, 194, 197, 199,
  201, 204, 208, 213, 219, 224, 228, 230, 231, 230,
  null, null,
  226, 221, 215, 209, 203, 197, 192, 187, 183, 179,
  176, 173, 171, 169, 167, 166, 165, 164,
] as const;

const USER_HZ = [
  171, 172, 174, 176, 179, 182, 184, 186, 188, 189,
  190, 191, 193, 195, 197, 199, 200, 201, 201, 200,
  null, null,
  199, 197, 195, 192, 190, 187, 185, 183, 181, 179,
  178, 177, 176, 175, 175, 174, 174, 173,
] as const;

/** The "native speaker" track. Illustrative mock data, not a measurement — see the file header. */
export const NATIVE_DEMO_CONTOUR: PitchContour = toContour(NATIVE_HZ);
/** The "you" track. Illustrative mock data, not a measurement — see the file header. */
export const USER_DEMO_CONTOUR: PitchContour = toContour(USER_HZ);
