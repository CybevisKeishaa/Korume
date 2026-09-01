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
 * ## Why the numbers are generated from a mora table (task A3)
 *
 * The first version was 40 hand-typed frames per track, each perfectly monotone
 * within its half: a smooth rise, a gap, a smooth fall. It plotted as two lazy
 * S-curves and read as a stock chart rather than as speech — the user's own
 * verdict on the built section ("cái sóng tôi muốn đặc sắc hơn"), and the
 * reason this file was rewritten. Real F0 moves PER MORA and jitters inside
 * each one, and reference `346:6275` draws exactly that: a dense trace with
 * roughly 60–80 inflections across the card.
 *
 * Typing ~170 frames by hand would have hidden the phrase behind the numbers,
 * so the phrase is stated as what it actually is — one row per mora, with the
 * pitch it starts and ends on — and expanded here. That keeps both binding
 * constraints legible at a glance:
 *
 *  1. the shape still reads as the sentence (rise across 日本の秋, peak on
 *     とても, fall through 美しいですね, unvoiced gap at the phrase break), and
 *  2. the "You" track still FLATTENS THE PEAK — 200 Hz against the native's
 *     228 — and over-shoots the final ね, which is what the Companion's
 *     feedback in this section is about.
 *
 * Deterministic: the per-frame jitter is a fixed table indexed by frame
 * position, not a random number generator. Same input, same output, forever.
 */
const FRAME_INTERVAL_SECONDS = 0.01;

/**
 * Frames each mora occupies, and the unvoiced frames at the phrase break.
 *
 * 18 morae x 9 frames + a 7-frame gap = 169 frames ≈ 1.7 s, which is a
 * plausible pace for this sentence. Both tracks use the same numbers, so the
 * two overlay frame-for-frame.
 */
const FRAMES_PER_MORA = 9;
const GAP_FRAMES = 7;

/** One mora and the pitch glide across it, in Hz. */
interface Mora {
  readonly kana: string;
  readonly from: number;
  readonly to: number;
}

/**
 * A speaker-relative baseline, the same quantity `medianVoicedHz` would
 * return. Illustrative mock data, not a measurement — see the file header.
 */
export const DEMO_REF_HZ = 180;

/**
 * 日本の秋は | とても美しいですね。 — the two accent phrases, split at the
 * particle は where the unvoiced gap falls.
 */
const NATIVE_PHRASES: readonly (readonly Mora[])[] = [
  [
    { kana: "に", from: 168, to: 177 },
    { kana: "ほ", from: 179, to: 187 },
    { kana: "ん", from: 187, to: 191 },
    { kana: "の", from: 189, to: 184 },
    { kana: "あ", from: 187, to: 197 },
    { kana: "き", from: 197, to: 204 },
    { kana: "は", from: 202, to: 193 },
  ],
  [
    { kana: "と", from: 197, to: 214 },
    { kana: "て", from: 216, to: 228 },
    { kana: "も", from: 226, to: 217 },
    { kana: "う", from: 213, to: 220 },
    { kana: "つ", from: 218, to: 209 },
    { kana: "く", from: 207, to: 199 },
    { kana: "し", from: 197, to: 191 },
    { kana: "い", from: 189, to: 183 },
    { kana: "で", from: 181, to: 175 },
    { kana: "す", from: 173, to: 167 },
    // 〜ですね rises as a soft confirmation. It stays BELOW the とても peak,
    // so the peak the first constraint names is still the phrase's high point.
    { kana: "ね", from: 166, to: 207 },
  ],
];

/**
 * The same phrase, learner-shaped: a narrower range throughout, a peak on
 * とても that barely rises (200 Hz against 228), a deeper trough through
 * ですし… and then an over-raised final ね. Two visible errors, one of which
 * — the flattened peak — is the pedagogical point of the whole overlay.
 */
const USER_PHRASES: readonly (readonly Mora[])[] = [
  [
    { kana: "に", from: 172, to: 177 },
    { kana: "ほ", from: 178, to: 182 },
    { kana: "ん", from: 182, to: 184 },
    { kana: "の", from: 184, to: 181 },
    { kana: "あ", from: 183, to: 188 },
    { kana: "き", from: 188, to: 191 },
    { kana: "は", from: 191, to: 186 },
  ],
  [
    { kana: "と", from: 187, to: 194 },
    { kana: "て", from: 195, to: 200 },
    { kana: "も", from: 200, to: 195 },
    { kana: "う", from: 194, to: 198 },
    { kana: "つ", from: 197, to: 192 },
    { kana: "く", from: 191, to: 187 },
    { kana: "し", from: 186, to: 182 },
    { kana: "い", from: 181, to: 175 },
    { kana: "で", from: 173, to: 166 },
    { kana: "す", from: 165, to: 158 },
    { kana: "ね", from: 157, to: 196 },
  ],
];

/**
 * Per-frame micro-jitter in Hz, indexed by absolute frame position.
 *
 * Two separate tables, of two different lengths, and neither length divides
 * `FRAMES_PER_MORA`: that is what stops the two traces wiggling in lockstep
 * (which would read as one line drawn twice) and stops the jitter lining up
 * with the mora boundaries (which would read as a repeating sawtooth).
 *
 * The density this produces is asserted, not stated here: `pitch-demo.test.ts`
 * counts the direction changes in each track and holds them inside the band
 * measured off the reference. Retuning a table is therefore a test failure if
 * it flattens the trace back out.
 */
const NATIVE_JITTER = [0, 2.4, 3.1, -1.2, -3.6, -1.8, 1.5, 3.8, 0.6, -2.7, -3.9, 1.1, 2.9] as const;
const USER_JITTER = [
  1.8, -2.2, -3.4, 0.7, 2.6, 3.3, -0.9, -3.1, -1.5, 2.1, 3.6, -0.4, -2.8, 1.3,
] as const;

/** Expands a mora table into per-frame Hz, `null` across the phrase break. */
function toHzFrames(
  phrases: readonly (readonly Mora[])[],
  jitter: readonly number[],
): (number | null)[] {
  const hz: (number | null)[] = [];
  phrases.forEach((phrase, phraseIndex) => {
    if (phraseIndex > 0) {
      for (let i = 0; i < GAP_FRAMES; i += 1) hz.push(null);
    }
    for (const mora of phrase) {
      for (let frame = 0; frame < FRAMES_PER_MORA; frame += 1) {
        const t = frame / (FRAMES_PER_MORA - 1);
        const glide = mora.from + (mora.to - mora.from) * t;
        const wobble = jitter[hz.length % jitter.length] ?? 0;
        hz.push(Math.round((glide + wobble) * 10) / 10);
      }
    }
  });
  return hz;
}

function toContour(hz: readonly (number | null)[]): PitchContour {
  return {
    frames: hz.map((value, i) => ({ time: i * FRAME_INTERVAL_SECONDS, hz: value })),
    sampleRate: 16000,
  };
}

/** The "native speaker" track. Illustrative mock data, not a measurement — see the file header. */
export const NATIVE_DEMO_CONTOUR: PitchContour = toContour(
  toHzFrames(NATIVE_PHRASES, NATIVE_JITTER),
);
/** The "you" track. Illustrative mock data, not a measurement — see the file header. */
export const USER_DEMO_CONTOUR: PitchContour = toContour(toHzFrames(USER_PHRASES, USER_JITTER));
