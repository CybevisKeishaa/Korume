import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NATIVE_DEMO_CONTOUR, USER_DEMO_CONTOUR, DEMO_REF_HZ } from "./pitch-demo";

const hzOf = (c: typeof NATIVE_DEMO_CONTOUR) => c.frames.map((f) => f.hz);

/**
 * Direction changes in a series, gaps resetting the state. This is the
 * quantity that separates "a trace that reads as speech" from "two lazy
 * S-curves": the contour this file replaced had a single direction change per
 * track.
 */
function inflections(hz: readonly (number | null)[]): number {
  let count = 0;
  let previous = 0;
  for (let i = 1; i < hz.length; i += 1) {
    const a = hz[i - 1];
    const b = hz[i];
    if (a === null || b === null || a === undefined || b === undefined) {
      previous = 0;
      continue;
    }
    const direction = Math.sign(b - a);
    if (direction !== 0 && previous !== 0 && direction !== previous) count += 1;
    if (direction !== 0) previous = direction;
  }
  return count;
}

/**
 * The largest single frame-to-frame FALL in a track, gaps excluded.
 *
 * This is the quantity that separates a pitch-ACCENT contour from a flat hum.
 * Japanese accent is a high plateau released at the nucleus, and the release
 * is the whole signal.
 *
 * ⚠️ Measured over a WINDOW, not frame to frame. A one-frame cliff satisfies
 * "there is a drop" and draws a CORNER, and corners are exactly what the
 * 2026-09-03 rebuild removes — `maxStep` below forbids them. A real accent
 * release takes ~0.2-0.3 s, which at 10 ms frames is this window.
 */
function maxFallOver(hz: readonly (number | null)[], window: number): number {
  let fall = 0;
  for (let i = window; i < hz.length; i += 1) {
    const a = hz[i - window];
    const b = hz[i];
    if (a === null || b === null || a === undefined || b === undefined) continue;
    fall = Math.max(fall, a - b);
  }
  return fall;
}

/**
 * The largest BEND: the second difference, |h[i+1] - 2h[i] + h[i-1]|, in Hz.
 *
 * ⚠️ This replaced a first-difference bound, and the correction matters. A
 * corner is a sudden change of SLOPE, not steepness itself — the reference
 * contour the owner supplied ends on a near-vertical climb that is perfectly
 * smooth. Bounding the slope outlawed that climb and pushed the fixture into
 * being a lazy curve; bounding the bend forbids kinks while leaving the line
 * free to move as fast as speech actually does.
 */
function maxBend(hz: readonly (number | null)[]): number {
  let bend = 0;
  for (let i = 1; i < hz.length - 1; i += 1) {
    const a = hz[i - 1];
    const b = hz[i];
    const c = hz[i + 1];
    if (a == null || b == null || c == null) continue;
    bend = Math.max(bend, Math.abs(c - 2 * b + a));
  }
  return bend;
}

/**
 * Lag-1 autocorrelation of the FIRST DIFFERENCES: how much a step tends to be
 * followed by a step in the same direction.
 *
 * ⚠️ This is the metric that actually separates the two things this fixture
 * has been rejected for, and it took three tries to find. `maxBend` and the
 * inflection count do NOT separate them — the shipped fixtures bend 5.60/5.20
 * with 38/37 direction changes against A3's 10.30/7.90 with 71/65, which is
 * the same neighbourhood. What differs is CAUSE: A3 drew an independent value
 * per frame from a lookup table, so its steps barely predict one another
 * (0.327 / 0.273); this is a sum of periodic components, so they strongly do
 * (0.720 / 0.697).
 *
 * ⚠️ The A3 figures are the only hand-kept numbers left in this file: they
 * come from `git show 81ff680^` and cannot be re-derived from HEAD. Every
 * number describing the SHIPPED fixtures is re-derived and asserted by
 * "the header's measurement table still describes these fixtures" below —
 * do not restate one here.
 *
 * ▶ Grain and movement can look equally busy on any single-frame statistic.
 * The question worth asking is whether consecutive samples KNOW about each
 * other, and this is that question.
 */
function deltaCoherence(hz: readonly (number | null)[]): number {
  const deltas: number[] = [];
  for (let i = 1; i < hz.length; i += 1) {
    const a = hz[i - 1];
    const b = hz[i];
    if (a == null || b == null) continue;
    deltas.push(b - a);
  }
  const mean = deltas.reduce((sum, v) => sum + v, 0) / deltas.length;
  let numerator = 0;
  let denominator = 0;
  deltas.forEach((value, i) => {
    const centred = value - mean;
    denominator += centred * centred;
    if (i > 0) numerator += centred * ((deltas[i - 1] as number) - mean);
  });
  return numerator / denominator;
}

/**
 * A centred moving average, wide enough to remove the detail layer.
 *
 * ⚠️ Phrase-level claims must be measured on a phrase-level signal. The
 * fixture is built as `intonation + detail`, and the detail now runs ~10 Hz at
 * an ~8-frame period. Asking "how far does the line fall over 40 frames" of
 * the RAW samples answers partly about the sentence and partly about wherever
 * the detail's trough happened to land — measured, that inflated the You
 * track's apparent release by ~10 Hz and failed a bound that was correct.
 *
 * The window is 9, one frame wider than the fastest detail period, so a whole
 * cycle of it averages out. What survives is the intonation the control table
 * describes, which is what the assertions below are actually about.
 */
function smoothed(hz: readonly (number | null)[], window = 9): (number | null)[] {
  const half = Math.floor(window / 2);
  return hz.map((value, i) => {
    if (value == null) return null;
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(hz.length - 1, i + half); j += 1) {
      const v = hz[j];
      if (v == null) continue;
      sum += v;
      count += 1;
    }
    return count > 0 ? sum / count : null;
  });
}

/** Narrows an indexed lookup the tests have already asserted the shape of. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what}`);
  return value;
}

/** Index ranges of the voiced runs, i.e. the phrases between unvoiced gaps. */
function voicedRuns(hz: readonly (number | null)[]): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  hz.forEach((value, i) => {
    if (value !== null && start === null) start = i;
    if (value === null && start !== null) {
      runs.push({ start, end: i });
      start = null;
    }
  });
  if (start !== null) runs.push({ start, end: hz.length });
  return runs;
}

describe("pitch demo fixtures", () => {
  it("gives both contours the same number of frames so they overlay frame-for-frame", () => {
    expect(NATIVE_DEMO_CONTOUR.frames.length).toBeGreaterThan(20);
    expect(USER_DEMO_CONTOUR.frames.length).toBe(NATIVE_DEMO_CONTOUR.frames.length);
  });

  it("puts both on the SAME time grid, which is what lets them share one plot", () => {
    // `pitch-chart.tsx` computes one shared vertical range across both tracks
    // and plots each with it. That only reads as a comparison if the two are
    // sampled at the same instants.
    const nativeTimes = NATIVE_DEMO_CONTOUR.frames.map((f) => f.time);
    const userTimes = USER_DEMO_CONTOUR.frames.map((f) => f.time);

    expect(nativeTimes.length).toBeGreaterThan(20);
    expect(userTimes).toEqual(nativeTimes);
  });

  it("keeps both inside a plausible speaking range", () => {
    const voiced = [...NATIVE_DEMO_CONTOUR.frames, ...USER_DEMO_CONTOUR.frames]
      .map((f) => f.hz)
      .filter((hz): hz is number => hz !== null);

    expect(voiced.length).toBeGreaterThan(0);
    for (const hz of voiced) {
      expect(hz).toBeGreaterThan(70);
      expect(hz).toBeLessThan(400);
    }
  });

  it("makes the two contours differ — an overlay of identical curves shows nothing", () => {
    const native = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);
    const user = USER_DEMO_CONTOUR.frames.map((f) => f.hz);

    expect(native).not.toEqual(user);
  });

  it("is deterministic — no randomness, no clock", () => {
    const a = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);
    const b = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);

    expect(a).toEqual(b);
    expect(DEMO_REF_HZ).toBeGreaterThan(0);
  });

  it("moves like speech, not like a stock chart (task A3)", () => {
    // The rewritten reason for this file: the previous fixtures were 40
    // perfectly monotone frames per track — a smooth rise, a gap, a smooth
    // fall — which is ONE inflection each. This is the FLOOR that forbids
    // going back to that, and it is deliberately only a floor.
    //
    // ⚠️ It used to be a 55–85 BAND, and the ceiling is dropped — not because
    // the 2026-09-03 redraw broke it, but because THE COUNT DID NOT MOVE AT
    // ALL. Measured on both versions of the fixtures: 71 native and 65 You,
    // before and after a redraw that changed the graphic completely. A metric
    // blind to that difference is not measuring the graphic; it is measuring
    // the jitter table's sign pattern.
    //
    // A3 tuned that jitter until the count matched a reference tracing, on
    // the reading that the owner's "đặc sắc hơn" meant "denser". ±3.9 Hz of
    // wobble on a ~70 Hz range drew ~±6.6 px of zigzag on a 153 px chart, so
    // the trace read as noise and the accent structure under it was
    // invisible — and the owner's verdict on that build was that nothing had
    // changed. The two tests below are what guard the design now.
    const counts = [inflections(hzOf(NATIVE_DEMO_CONTOUR)), inflections(hzOf(USER_DEMO_CONTOUR))];

    expect(counts).toHaveLength(2);
    for (const count of counts) {
      // The floor forbids the two lazy S-curves. The ceiling is the half that
      // matters now and is the reverse of what this test used to demand: the
      // owner's brief for the rebuild is explicit that the contour must avoid
      // "excessive high-frequency noise" and read as intonation, so a trace
      // that changes direction on every other frame is a FAILURE here, not a
      // pass. See the note above for how the old 55–85 band got that backwards.
      // Retuned 2026-09-03 against the reference contour the owner supplied,
      // which carries roughly 30-40 direction changes across the card. The
      // first attempt at this rebuild landed on SEVEN and read as a lazy
      // curve — "đặc sắc" means a living line, not a calm one. Grain is ruled
      // out by `maxBend` rather than by a ceiling here.
      expect(count).toBeGreaterThanOrEqual(18);
      expect(count).toBeLessThanOrEqual(80);
    }
  });

  it("MOVES, rather than being grainy — consecutive steps predict each other", () => {
    // ⚠️ THE load-bearing test of the 2026-09-03 rebuild, and the third metric
    // tried for the job. The first two were wrong in an instructive way:
    //
    //   - bounding the SLOPE outlawed the reference's near-vertical closing
    //     lift and forced the contour into being a lazy curve;
    //   - bounding the BEND was loosened twice (2.5 -> 4 -> …) because every
    //     step toward the density the owner asked for tripped it. It had to
    //     be, because sharpness is not the defect: the owner's own reference
    //     is sharp.
    //
    // What was actually wrong with the rejected A3 build is that its variation
    // was drawn INDEPENDENTLY per frame, so the line had no direction from one
    // sample to the next. That is grain, and it is invisible to both metrics
    // above. This measures it directly — see `deltaCoherence` for the numbers
    // on both builds.
    //
    // 0.45 sits between the two populations with room either side.
    for (const [name, contour] of [
      ["native", NATIVE_DEMO_CONTOUR],
      ["you", USER_DEMO_CONTOUR],
    ] as const) {
      expect(deltaCoherence(hzOf(contour)), name).toBeGreaterThanOrEqual(0.45);
    }
  });

  it("keeps the bend inside a sanity bound — no return to A3's grain", () => {
    // Kept as a coarse backstop only, NOT as the design constraint it used to
    // be. It catches a wholesale regression; the test above is what pins the
    // quality.
    for (const [name, contour] of [
      ["native", NATIVE_DEMO_CONTOUR],
      ["you", USER_DEMO_CONTOUR],
    ] as const) {
      // 8 is not a guess, and it has been raised once. Measured on the A3
      // fixtures — the build the owner called "trông rất xấu" — the bend was
      // 10.30 (native) and 7.90 (You), so the bound sits under the population
      // it must reject. The shipped fixtures' own bend is re-derived by the
      // measurement-table test below rather than restated here.
      //
      // ▶ What the bound is actually for: A3's wobble was applied
      // INDEPENDENTLY per frame, so it had no period and no coherence — that
      // is grain. This layer is three periodic components, so however sharp
      // its peaks get they are still movement. The bound is set to catch a
      // return to grain, not to police sharpness.
      expect(maxBend(hzOf(contour)), name).toBeLessThanOrEqual(8);
    }
  });

  it("carries its variation as a slow undulation, not as per-frame grain", () => {
    // "Subtle and coherent", per the owner's brief. Coherence is testable:
    // grain has no correlation between neighbouring steps, while a slow
    // undulation keeps moving the same way for many frames at a time. The
    // average run length between direction changes is what tells them apart —
    // A3's rejected fixtures ran 2.25 frames per run, i.e. noise.
    for (const [name, contour] of [
      ["native", NATIVE_DEMO_CONTOUR],
      ["you", USER_DEMO_CONTOUR],
    ] as const) {
      const voiced = hzOf(contour).filter((v): v is number => v !== null);
      const runLength = voiced.length / (inflections(hzOf(contour)) + 1);

      expect(voiced.length, name).toBeGreaterThan(100);
      // ⚠️ A COARSE BACKSTOP, not the guard. A3's rejected fixtures ran 2.25
      // frames per direction, which is the same ORDER as these — run length is
      // another single-frame statistic and cannot tell dense movement from
      // grain. `deltaCoherence` is what actually separates the two builds
      // (A3 measured 0.327 / 0.273). This only rules out a reversal on almost
      // every frame.
      expect(runLength, `${name} does not reverse on nearly every frame`).toBeGreaterThan(2.5);
    }
  });

  it("draws the ACCENT RELEASE — the fall that makes this pitch accent", () => {
    // Japanese pitch accent is a rise to a plateau and then a marked fall at
    // the nucleus. Drawn as a gentle hill it is intonation, not accent, and §4
    // exists to sell accent visualisation (CLAUDE.md §5, 差別化 #1).
    //
    // 40 frames is 0.4 s. The reference contour does not fall in one clean
    // sweep — it descends in steps, with small rises inside the descent — so
    // the window has to be wide enough to span that, and measuring over a
    // window rather than frame-to-frame is what lets the fall be large AND
    // smooth at the same time.
    const native = hzOf(NATIVE_DEMO_CONTOUR);

    expect(native.length).toBeGreaterThan(100);
    expect(
      maxFallOver(smoothed(native), 40),
      "the native track must release its plateau at the accent nucleus",
    ).toBeGreaterThanOrEqual(35);
  });

  it("gives the You track NO release — failing to drop is the error on display", () => {
    // The two tracks' pedagogical contrast: the learner reaches a lower peak
    // AND never releases it. A "You" track that fell too would show a quieter
    // voice, not an accent error.
    const nativeFall = maxFallOver(smoothed(hzOf(NATIVE_DEMO_CONTOUR)), 40);
    const userFall = maxFallOver(smoothed(hzOf(USER_DEMO_CONTOUR)), 40);

    // Measured on the SMOOTHED signal — see `smoothed` for why the raw one
    // answers the wrong question once the detail layer is this deep. The
    // learner's pitch does fall — everyone's does at the end of a sentence —
    // the error is that it falls far less, and stays above the native right
    // through the release instead of dropping with it.
    expect(userFall).toBeLessThanOrEqual(26);
    expect(
      nativeFall / userFall,
      "the release has to be the visible difference between the two tracks",
    ).toBeGreaterThanOrEqual(2);
  });

  it("ends the You track ABOVE its own peak — the over-raised final ね", () => {
    // The second of the two errors the Companion's feedback in §4 names. It is
    // a property the native track must NOT have, or it stops being an error.
    const user = hzOf(USER_DEMO_CONTOUR).filter((v): v is number => v !== null);
    const native = hzOf(NATIVE_DEMO_CONTOUR).filter((v): v is number => v !== null);

    expect(user.length).toBeGreaterThan(100);
    const userEnd = must(user[user.length - 1], "the You track's last frame");
    const nativeEnd = must(native[native.length - 1], "the native track's last frame");

    // Its own peak is taken BEFORE the closing lift, so "above its own peak"
    // means the lift overshoots the accent it never made.
    expect(userEnd).toBeGreaterThan(Math.max(...user.slice(0, -9)));
    expect(nativeEnd).toBeLessThan(Math.max(...native.slice(0, -9)));
  });

  it("runs as ONE unbroken stroke, with the phrase break drawn as a VALLEY", () => {
    // ⚠️ This REVERSES an earlier decision, deliberately. The fixture carried
    // a 70 ms unvoiced gap after は, on the reasoning that silence has no F0
    // to plot. That reasoning is sound for real audio and `toPath` still
    // renders gaps — `contour-path.test.ts` covers the pen-up behaviour and
    // the product's own overlay depends on it. It was wrong for THIS fixture.
    //
    // The owner's brief asks for "a single continuous organic line", and
    // connected speech does not pause here: a Japanese phrase boundary is
    // marked by a pitch VALLEY — the phrase-final fall on は, then the reset
    // up into the next accent phrase — not by silence. The control tables now
    // draw that valley, which reads as the boundary without cutting the line.
    for (const [name, contour] of [
      ["native", NATIVE_DEMO_CONTOUR],
      ["you", USER_DEMO_CONTOUR],
    ] as const) {
      const hz = hzOf(contour);
      const runs = voicedRuns(hz);

      expect(runs, name).toHaveLength(1);
      const only = must(runs[0], `${name} voiced run`);
      expect(only.start, name).toBe(0);
      expect(only.end, name).toBe(hz.length);

      // And the boundary is still THERE: the low point of frames 55..80 sits
      // strictly inside that span and below both of its ends, so the two
      // accent phrases stay legible as two.
      // Smoothed: the valley is a phrase-level event, and at this detail depth
      // a raw sample near the window's edge can dip below the valley itself.
      const around = smoothed(hz)
        .slice(55, 81)
        .map((v) => must(v ?? undefined, `${name} frame`));
      const valley = Math.min(...around);
      const valleyAt = around.indexOf(valley);

      expect(valleyAt, `${name} valley is interior`).toBeGreaterThan(0);
      expect(valleyAt, `${name} valley is interior`).toBeLessThan(around.length - 1);
      expect(must(around[0], "start"), name).toBeGreaterThan(valley + 4);
      expect(must(around[around.length - 1], "end"), name).toBeGreaterThan(valley + 4);
    }
  });

  it("reads as 日本の秋はとても美しいですね。 — rise, peak on とても, fall", () => {
    const hz = hzOf(NATIVE_DEMO_CONTOUR).map((v) => v ?? Number.NaN);
    const at = (i: number) => must(hz[i], `frame ${i}`);
    expect(hz.length).toBe(169);

    // 日本の秋 rises: the first accent phrase is higher at its end than at its
    // start. Frame 55 is inside は, before the boundary valley.
    expect(at(55)).toBeGreaterThan(at(0));

    // The sentence's high point falls in とても. The gap used to make this
    // window derivable from the second voiced run; with one continuous stroke
    // it is stated as a FRACTION of the sentence instead. とても sits at
    // roughly 52-63% of 日本の秋はとても美しいですね — after the boundary
    // valley, before the release — and the window stays tight enough to
    // exclude 秋, which is where the mutation check moves the peak to.
    const peak = Math.max(...hz.filter((v) => !Number.isNaN(v)));
    const peakAt = hz.indexOf(peak) / (hz.length - 1);

    expect(peakAt).toBeGreaterThan(0.5);
    expect(peakAt).toBeLessThan(0.68);

    // …and 美しいですね falls away from it: the trough after the peak sits
    // well below it, and the closing ね lift stays under it.
    const tail = hz.slice(hz.indexOf(peak));
    expect(Math.min(...tail)).toBeLessThan(peak - 40);
    expect(at(hz.length - 1)).toBeLessThan(peak);
  });

  it("makes the You track FLATTEN the peak — the error the real scorer surfaces", () => {
    const native = hzOf(NATIVE_DEMO_CONTOUR).filter((v): v is number => v !== null);
    const user = hzOf(USER_DEMO_CONTOUR).filter((v): v is number => v !== null);

    expect(native.length).toBeGreaterThan(100);
    expect(user).toHaveLength(native.length);

    // ⚠️ Compared over the PEAK REGION, not over the whole sentence. Both
    // tracks end on a rising ね, and the You track's closing lift is
    // deliberately its own highest point (the second error, below) — so a
    // global-maximum comparison silently stops measuring the peak and starts
    // measuring the two closing lifts against each other. Frames 90-115 are
    // とても, where the accent the learner missed actually lives.
    const region = (hz: readonly number[]) => Math.max(...hz.slice(90, 116));

    expect(region(native) - region(user), "the flattened peak").toBeGreaterThanOrEqual(20);
  });

  /**
   * The file header carries a measurement table describing these fixtures.
   *
   * ⚠️ This test exists because FOUR separate docblocks used to restate parts
   * of that table by hand and every one of them had drifted — in one case
   * giving two different values for a single quantity nine lines apart. That
   * is CLAUDE.md §6 ("one fact, one home") failing in the only way a comment
   * can fail: silently and permanently, because nothing ever re-runs a
   * comment. The copies are gone; this makes the surviving original
   * self-verifying, so retuning the fixtures without updating the table turns
   * this red instead of leaving a plausible wrong number behind forever.
   *
   * It reads the SOURCE TEXT rather than importing a constant on purpose: the
   * thing at risk of going stale is the prose a human reads.
   */
  it("keeps the header's measurement table true of the fixtures it describes", () => {
    const source = readFileSync(join(__dirname, "pitch-demo.ts"), "utf8");
    const table = source.split("▶ Measured on the current fixtures:")[1]?.split("⚠️")[0];
    expect(table, "the header's measurement table").toBeTruthy();

    const lines = must(table, "the table block")
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s*/, ""));

    // ⚠️ L-004: assert the SIZE of the collection this test walks. Without
    // this, a seventh row added to the table would simply go unchecked and
    // the test would stay green while the new number rotted.
    const rows = lines.filter((line) => /^[a-z]/.test(line) && /\d/.test(line));
    expect(rows, "rows in the measurement table").toHaveLength(6);

    /** The numbers documented on the row labelled `label`, in written order. */
    const documented = (label: string): string[] => {
      const line = rows.find((row) => row.startsWith(label));
      const found = must(line, `a table row for "${label}"`).match(/\d+(?:\.\d+)?/g) ?? [];
      expect(found.length, `numbers on the "${label}" row`).toBeGreaterThanOrEqual(2);
      return found;
    };

    /**
     * Compare at the precision the table itself states — "19.7" is satisfied
     * by 19.71 but not by 19.8. Asserting more precision than the prose claims
     * would make the test fail for a rounding the reader cannot see.
     */
    const agrees = (derived: number, claimed: string, what: string) => {
      const decimals = claimed.includes(".") ? must(claimed.split(".")[1], what).length : 0;
      expect(derived.toFixed(decimals), what).toBe(claimed);
    };

    const native = hzOf(NATIVE_DEMO_CONTOUR);
    const you = hzOf(USER_DEMO_CONTOUR);
    const voiced = (hz: readonly (number | null)[]) => hz.filter((v): v is number => v !== null);
    // The same とても window the flattened-peak test above uses, for the same
    // reason — both tracks end on a rising ね, so a global maximum stops
    // measuring the peak and starts measuring the two closing lifts.
    const peak = (hz: readonly (number | null)[]) => Math.max(...voiced(hz).slice(90, 116));

    const range = documented("range");
    expect(range, "both tracks' floor and ceiling").toHaveLength(4);
    agrees(Math.min(...voiced(native)), must(range[0], "native floor"), "native range floor");
    agrees(Math.max(...voiced(native)), must(range[1], "native ceiling"), "native range ceiling");
    agrees(Math.min(...voiced(you)), must(range[2], "you floor"), "you range floor");
    agrees(Math.max(...voiced(you)), must(range[3], "you ceiling"), "you range ceiling");

    const peaks = documented("peak region");
    agrees(peak(native), must(peaks[0], "native peak"), "native peak on とても");
    agrees(peak(you), must(peaks[1], "you peak"), "you peak on とても");
    agrees(peak(native) - peak(you), must(peaks[2], "the gap"), "the peak gap the table names");

    const release = documented("release");
    const window = Number(must(release[2], "the smoothing window"));
    expect(window, "the release window the table names").toBe(40);
    agrees(maxFallOver(smoothed(native), window), must(release[0], "native"), "native release");
    agrees(maxFallOver(smoothed(you), window), must(release[1], "you"), "you release");

    const changes = documented("direction changes");
    agrees(inflections(native), must(changes[0], "native"), "native direction changes");
    agrees(inflections(you), must(changes[1], "you"), "you direction changes");

    const coherence = documented("coherence");
    agrees(deltaCoherence(native), must(coherence[0], "native"), "native coherence");
    agrees(deltaCoherence(you), must(coherence[1], "you"), "you coherence");

    const bend = documented("bend");
    agrees(maxBend(native), must(bend[0], "native"), "native bend");
    agrees(maxBend(you), must(bend[1], "you"), "you bend");
  });
});
