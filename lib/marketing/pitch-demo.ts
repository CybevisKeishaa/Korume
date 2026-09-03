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
 * They are shaped like 日本の秋はとても美しいですね。 — a stepped rise across
 * 日本の秋, a valley at the phrase boundary, a climb to a peak on とても, a
 * release through 美しい and a closing lift on ね. The "You" track follows the
 * same phrase but flattens the peak and barely releases it, which is exactly
 * the error the real scorer is built to surface.
 *
 * ## ⚠️ Rebuilt 2026-09-03 on the owner's brief. Read this before retuning.
 *
 * This file has been rejected FOUR times, and every rejection was the same
 * mistake in a new place: controlling a quantity that was not the one that
 * made it look wrong.
 *
 *  1. The original was 40 monotone frames per track — two lazy S-curves that
 *     read as a stock chart. The owner asked for something "đặc sắc hơn".
 *  2. Task A3 read "đặc sắc" as DENSER and added ±3.9 Hz of INDEPENDENT
 *     per-frame jitter over a mora table, drawn with `L` commands so every
 *     sample was also a corner. Verdict: "trông rất xấu".
 *  3. This rebuild's first pass bounded the SLOPE, on the theory that
 *     steepness drew the corners. That outlawed the near-vertical closing lift
 *     the owner's own reference ends on and smoothed the fixture down to SEVEN
 *     direction changes — a lazy curve again.
 *  4. Its second pass bounded the BEND and had to be loosened twice, because
 *     the reference IS sharp. Sharpness was never the defect.
 *
 * ▶ WHAT THE DEFECT ACTUALLY WAS. A3 drew each frame's deviation independently
 * of its neighbours, so the line had no direction from one sample to the next.
 * That is GRAIN, and no single-frame statistic sees it: measured, A3 bent 10.30
 * with 71 direction changes and this bends 5.60 with 38 — the same
 * neighbourhood. The lag-1 autocorrelation of the first differences separates
 * them cleanly, 0.327 against 0.720, and `pitch-demo.test.ts` now guards that
 * instead. Depth and density are free; incoherence is not.
 *
 * ## How the fixture is built
 *
 *   ~19 control points (the intonation)  ->  Hermite interpolation
 *     + a detail layer (three short-period components)  ->  169 frames
 *
 * The two layers are separate DIALS and were repeatedly turned together by
 * mistake. Period and amplitude are independent: the owner's last correction
 * was that the excursions had become too crowded horizontally while still not
 * deep enough, which is one dial each.
 *
 * ▶ Measured on the current fixtures:
 *
 *                     native      you
 *     range        167.2-233.6  173.3-211.8 Hz
 *     peak region  233.6        204.1        (とても — a 29.5 Hz gap)
 *     release      46.1         17.8         (over 40 smoothed frames)
 *     direction changes  38     40
 *     coherence     0.720       0.692
 *     bend          5.60        5.10
 *
 * ⚠️ Phrase-level claims — the release, the boundary valley — are asserted
 * against a SMOOTHED signal. The detail layer runs ~10 Hz deep at an ~8-frame
 * period, so a raw 40-frame window answers partly about the sentence and
 * partly about where a detail trough landed. See `smoothed` in the test.
 *
 * Deterministic: the detail layer is fixed periodic functions, not a random
 * number generator. Same input, same output, forever.
 */
const FRAME_INTERVAL_SECONDS = 0.01;

/** One control point: an absolute frame index and the pitch at it, in Hz. */
interface ControlPoint {
  readonly frame: number;
  readonly hz: number;
}

/**
 * 169 frames at 10 ms ≈ 1.7 s, a plausible pace for this sentence.
 *
 * ## ⚠️ There is no unvoiced gap here any more, and that is deliberate
 *
 * This fixture used to go `null` for seven frames after the particle は, so
 * `contour-path.ts` lifted the pen and the trace broke in two. The reasoning
 * was sound in general — silence has no F0 to plot — and the CAPABILITY is
 * untouched: `toPath` still renders gaps, `contour-path.test.ts` still pins
 * that behaviour, and the product's real overlay still depends on it.
 *
 * It was wrong for THIS sentence. The owner asked why the line kept breaking
 * in the middle, and their brief asks for "a single continuous organic line".
 * A native speaker does not pause between 日本の秋は and とても: the phrase
 * boundary is marked by a pitch VALLEY — the phrase-final fall on は, then the
 * reset upward into the new accent phrase — and drawing it that way shows the
 * boundary MORE clearly than a hole did, because a hole shows nothing at all.
 */
const TOTAL_FRAMES = 169;

/**
 * 日本の秋は | とても美しいですね。
 *
 * Forty-three control points, not 169 hand-typed frames: the shape has to stay
 * legible as a SHAPE, and `interpolate` fills in the rest. Reading down the
 * `hz` column is reading the intonation.
 *
 * They sit ~4 frames apart, which is roughly half a mora — close enough to
 * carry the per-mora lift-and-settle that makes the line read as speech, far
 * enough apart that the spline through them never has to turn sharply. That
 * spacing IS the design: the previous attempt put the local structure in an
 * added sinusoid instead and could not make it show, because a sinusoid only
 * turns the line around where its slope beats the base curve's.
 */
const NATIVE_CONTROL: readonly ControlPoint[] = [
  // 日本の秋は — the phrase climbs, then falls into the boundary.
  { frame: 0, hz: 178 },
  { frame: 12, hz: 185 },
  { frame: 24, hz: 190 },
  { frame: 36, hz: 195 },
  { frame: 48, hz: 191 },
  // は — the phrase-final fall into the PHRASE BOUNDARY VALLEY. No unvoiced
  // gap: the boundary is a low point, not a hole. See TOTAL_FRAMES.
  //
  // Deliberately SHALLOW. A deeper dip here plus the detail layer's own
  // downstroke cut a sharp V that pulled the eye to the middle of the card;
  // the reference only troughs gently there.
  { frame: 58, hz: 180 },
  { frame: 66, hz: 172 },
  // とても — the second phrase resets upward and climbs to the peak.
  { frame: 74, hz: 189 },
  { frame: 86, hz: 203 },
  { frame: 96, hz: 218 },
  { frame: 101, hz: 230 },
  { frame: 108, hz: 221 },
  // 美しい — THE RELEASE.
  { frame: 118, hz: 208 },
  { frame: 128, hz: 196 },
  { frame: 138, hz: 187 },
  // ですね — low, then the closing lift. Steepness is fine here; only a sharp
  // BEND would draw a corner.
  { frame: 148, hz: 178 },
  { frame: 157, hz: 172 },
  { frame: 163, hz: 182 },
  { frame: 168, hz: 203 },
];

/**
 * The same phrase, learner-shaped. Two errors, both deliberate:
 *
 *  1. THE FLATTENED PEAK — it reaches well under the native on とても and then
 *     barely releases, staying ABOVE the native right through the fall instead
 *     of dropping with it. It is not a quieter voice, it is a missing accent.
 *  2. THE OVER-RAISED FINAL ね — it ends at its own highest point, where the
 *     native's closing lift stops short of its peak.
 *
 * ⚠️ Deliberately stated without numbers. Both errors are quantified once, in
 * the file header's measurement table, which `pitch-demo.test.ts` re-derives
 * from these fixtures and asserts. This block used to restate four of those
 * values and all four had gone stale against it (CLAUDE.md §6, one fact one
 * home) — so state the SHAPE here and let the table own the magnitudes.
 *
 * It shares the native's timeline frame for frame so the two overlay, and the
 * two converge around the phrase-boundary valley so the pair reads as two
 * takes of one sentence rather than as two unrelated lines.
 */
const USER_CONTROL: readonly ControlPoint[] = [
  // The same sentence on the same timeline, but NOT glued to the native line.
  //
  // ⚠️ The gap between the two tracks is deliberately UNEVEN — the owner asked
  // for exactly that: "có thể lệch nhiều lệch ít, chứ không nhất thiết phải
  // dính liền nhau". Through 日本の秋 the two cross each other twice; at the
  // phrase boundary the learner sits above; through とても they separate by
  // ~30 Hz, which is the error the section is about; and they close again on
  // the final ね.
  //
  // An earlier pass tried to separate them by giving the learner an
  // out-of-phase settle at every mora. That produced a regular braid, which
  // the owner read immediately as unnatural. Separation belongs in the phrase
  // shape, where it means something, not in the detail layer's rhythm.
  //
  // ⚠️ THESE POINTS ARE DELIBERATELY CLOSE THROUGH 日本の秋, and that is not
  // the thing to change if the pair ever braids again. The two tracks SHOULD
  // agree on the easy part of the sentence — the error §4 exists to show is
  // the accent on とても, and pulling them apart earlier turns "missed the
  // accent" into "spoke in a higher register", which is a different error and
  // not the one the copy describes. When the pair braided (25 crossings, left
  // 40% of the plot) the cause was in `userDetail`, which had its own periods;
  // it now shares the native's. See its docblock.
  { frame: 0, hz: 186 },
  { frame: 12, hz: 188 },
  { frame: 24, hz: 189 },
  { frame: 36, hz: 191 },
  { frame: 48, hz: 193 },
  { frame: 58, hz: 186 },
  { frame: 66, hz: 180 },
  { frame: 74, hz: 188 },
  { frame: 86, hz: 193 },
  { frame: 96, hz: 196 },
  // ERROR 1 — the flattened peak, ~32 Hz under the native's, and then no
  // release: where the native sheds its plateau this merely drifts, ending up
  // ABOVE the native all the way down.
  { frame: 101, hz: 198 },
  { frame: 108, hz: 197 },
  { frame: 118, hz: 195 },
  { frame: 128, hz: 191 },
  { frame: 138, hz: 186 },
  { frame: 148, hz: 183 },
  { frame: 157, hz: 178 },
  { frame: 163, hz: 181 },
  // ERROR 2 — the over-raised ね, climbing past its own peak.
  { frame: 168, hz: 206 },
];

/**
 * A triangle wave in -1..1. Straight ramps, sharp vertices.
 *
 * ⚠️ Not a sine, and that is the point. A sine's extrema are ROUND: sampled
 * every frame it spends several frames near its peak, so the trace scallops.
 * The reference contour does not scallop — the owner's description is "giống
 * những tia sét" — it runs straight and turns hard. `contour-path.ts` softens
 * each vertex just enough that nothing reads as a kink, which is why the data
 * can be this angular and the line still looks drawn rather than plotted.
 */
function triangle(x: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(x));
}

/**
 * The DETAIL layer: the fast excursions that sit on top of the phrase shape.
 *
 * Three components with SHORT, mutually incommensurable periods — roughly 8,
 * 13 and 22 frames. Each choice is doing a job:
 *
 *  - SHORT is what makes it read as speech. 8 frames is ~21 CSS px on the
 *    rendered chart. An early pass used 40 and 22 frames — 60 px and 33 px —
 *    which drew broad rolling swells and read as unnatural beside the
 *    reference. A later one went the other way to 5.5 frames, and the owner's
 *    correction was that the excursions had become too CROWDED horizontally
 *    while still not deep enough: period and amplitude are separate dials and
 *    were being turned together. They now sit at 8 frames and ~10.4 Hz.
 *  - TRIANGLE, not sine, for the two fast components: sharp excursions rather
 *    than scallops. The slow one stays a sine because it is doing phrase-level
 *    work, where a vertex would read as a real pitch event.
 *  - INCOMMENSURABLE periods stop it looking mechanical. Each period is
 *    `2π / ω` of the coefficients in the two functions below — native 8.00,
 *    13.01, 22.52 frames; You 9.00, 14.41, 25.23 — so the sum never repeats
 *    inside the sentence: peaks land at irregular intervals and reach
 *    irregular heights. Read them off the coefficients rather than trusting
 *    this line; an earlier attempt hand-alternated the control table to get
 *    that irregularity and produced a visible braid instead.
 *  - AMPLITUDE is ~10.4 Hz against a 66.4 Hz range. That is a LOT — roughly a
 *    sixth of the whole plot — and it is deliberate: the owner asked for depth
 *    twice. It is safe because the movement is coherent. A3's ±3.9 Hz was far
 *    smaller and looked far worse, because it was drawn INDEPENDENTLY per
 *    frame and so had no period at all. Depth is not what made A3 grain.
 *
 * The two tracks use different frequencies, so they drift in and out of step
 * across the sentence instead of shadowing each other or braiding on a beat.
 *
 * Deterministic: fixed constants, no random number generator, no clock.
 */
function nativeDetail(frame: number): number {
  return (
    5.2 * triangle(frame * 0.785 + 0.6) +
    3.2 * triangle(frame * 0.483 + 2.1) +
    2.0 * Math.sin(frame * 0.279 + 4.3)
  );
}

/**
 * The You track's detail: the SAME three periods as the native, at slightly
 * smaller amplitudes.
 *
 * ## ⚠️ The shared periods are load-bearing. Do not give this its own.
 *
 * They used to differ (0.698 / 0.436 / 0.249 against the native's 0.785 /
 * 0.483 / 0.279) so the two tracks would "drift in and out of step instead of
 * shadowing each other". That reasoning is right about each track ALONE and
 * wrong about the PAIR, and it shipped a defect no per-track test could see:
 *
 *   two independent ~10 Hz textures make their DIFFERENCE swing by up to
 *   19.6 Hz, while the intonation separates the tracks by only ~5 Hz through
 *   日本の秋 — so which line was on top was decided by where a detail trough
 *   landed, not by the sentence. The pair crossed 25 times, in a visible
 *   braid through the left 40% of the plot, against a docblock that says
 *   they "cross each other twice".
 *
 * Sharing the periods makes the DIFFERENCE smooth without flattening either
 * line: each track still carries its full depth and its own coherence, and the
 * order changes only where the sentence changes it. Measured, control points
 * untouched: 25 crossings -> 6, and those six are separate events rather than
 * one braid.
 *
 * ▶ The amplitudes stay lower than the native's (4.6/2.8/1.8 against
 * 5.2/3.2/2.0). That is the pedagogy, not decoration: a learner moves their
 * pitch less. Tuning these is safe; tuning the PERIODS reopens the braid, and
 * `pitch-demo.test.ts` will say so.
 */
function userDetail(frame: number): number {
  return (
    4.6 * triangle(frame * 0.785 + 0.6) +
    2.8 * triangle(frame * 0.483 + 2.1) +
    1.8 * Math.sin(frame * 0.279 + 4.3)
  );
}

/**
 * A speaker-relative baseline, the same quantity `medianVoicedHz` would
 * return. Illustrative mock data, not a measurement — see the file header.
 */
export const DEMO_REF_HZ = 180;

/**
 * Cubic Hermite interpolation through the control points, with Catmull-Rom
 * tangents corrected for the uneven frame spacing above.
 *
 * Hermite rather than a plain polyline because the SAMPLES have to be smooth,
 * not only the path drawn through them: a corner in the data is a corner on
 * screen. Catmull-Rom tangents because they interpolate — the curve passes
 * exactly through every control point, so reading the table above tells you
 * what the graphic does.
 *
 * Tangents at the two ends are one-sided, which makes the contour leave its
 * first sample and arrive at its last along the chord instead of overshooting
 * into a pitch the sentence never reaches.
 */
function interpolate(control: readonly ControlPoint[], frame: number): number {
  const last = control[control.length - 1];
  const first = control[0];
  if (!first || !last) return DEMO_REF_HZ;
  if (frame <= first.frame) return first.hz;
  if (frame >= last.frame) return last.hz;

  let i = 0;
  while (i < control.length - 2 && (control[i + 1] as ControlPoint).frame <= frame) i += 1;

  const p0 = control[i] as ControlPoint;
  const p1 = control[i + 1] as ControlPoint;
  const before = control[i - 1] ?? p0;
  const after = control[i + 2] ?? p1;

  const h = p1.frame - p0.frame;
  const t = (frame - p0.frame) / h;
  // Secant-based tangents, scaled to this segment's width so an uneven gap
  // between control points cannot kink the curve where two segments meet.
  const m0 = ((p1.hz - before.hz) / (p1.frame - before.frame)) * h;
  const m1 = ((after.hz - p0.hz) / (after.frame - p0.frame)) * h;

  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0.hz +
    (t3 - 2 * t2 + t) * m0 +
    (-2 * t3 + 3 * t2) * p1.hz +
    (t3 - t2) * m1
  );
}

/**
 * Expands a control table into per-frame Hz.
 *
 * Every frame is voiced — see TOTAL_FRAMES for why this fixture no longer
 * carries an unvoiced gap. The return type stays nullable because
 * `PitchContour` is the shape real recordings arrive in, where gaps are
 * ordinary.
 */
function toHzFrames(
  control: readonly ControlPoint[],
  detail: (frame: number) => number,
): (number | null)[] {
  return Array.from({ length: TOTAL_FRAMES }, (_, frame) =>
    Math.round((interpolate(control, frame) + detail(frame)) * 10) / 10,
  );
}

function toContour(hz: readonly (number | null)[]): PitchContour {
  return {
    frames: hz.map((value, i) => ({ time: i * FRAME_INTERVAL_SECONDS, hz: value })),
    sampleRate: 16000,
  };
}

/** The "native speaker" track. Illustrative mock data, not a measurement — see the file header. */
export const NATIVE_DEMO_CONTOUR: PitchContour = toContour(
  toHzFrames(NATIVE_CONTROL, nativeDetail),
);
/** The "you" track. Illustrative mock data, not a measurement — see the file header. */
export const USER_DEMO_CONTOUR: PitchContour = toContour(
  toHzFrames(USER_CONTROL, userDetail),
);
