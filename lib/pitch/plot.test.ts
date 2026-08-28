import { describe, expect, it } from "vitest";
import { toPlotPoints, MIN_SEMITONE_SPAN, RANGE_PADDING_SEMITONES } from "./plot";
import { hzToSemitones } from "./contour";
import type { PitchContour } from "./types";

const contour = (hz: (number | null)[]): PitchContour => ({
  frames: hz.map((v, i) => ({ time: i * 0.01, hz: v })),
  sampleRate: 16000,
});

describe("toPlotPoints", () => {
  it("maps the first and last frame to the horizontal extremes", () => {
    const { points } = toPlotPoints(contour([200, 220, 240]), 220, 300, 100);

    expect(points).toHaveLength(3);
    expect(points[0]?.x).toBe(0);
    expect(points[2]?.x).toBe(300);
  });

  it("emits null for unvoiced frames so the renderer can break the line", () => {
    const { points } = toPlotPoints(contour([200, null, 240]), 220, 300, 100);

    expect(points).toHaveLength(3);
    expect(points[1]).toBeNull();
  });

  it("puts a higher pitch higher on the canvas (y grows downward)", () => {
    const { points } = toPlotPoints(contour([200, 300]), 220, 300, 100);

    expect(points[0]).not.toBeNull();
    expect(points[1]).not.toBeNull();
    expect(points[1]!.y).toBeLessThan(points[0]!.y);
  });

  it("floors a nearly-flat take to MIN_SEMITONE_SPAN — an exact scale, not a loose bound", () => {
    // Two frames exactly ONE semitone apart (fix round 1, F1 — a "hair apart"
    // + `drop < 10` loose bound stayed green with the floor block deleted
    // entirely: 3.776px < 10 as much as 1.963px < 10). One semitone across a
    // MIN_SEMITONE_SPAN=4 window is exactly height/4 = 25px WITH the floor;
    // without it the window would be (1 + 2*RANGE_PADDING_SEMITONES) = 3
    // semitones wide, giving height/3 ≈ 33.3px instead — the two are far
    // enough apart that only the real floor computation can land on 25.
    expect(MIN_SEMITONE_SPAN).toBe(4);
    const height = 100;
    const oneSemitoneUp = 220 * 2 ** (1 / 12);

    const { points } = toPlotPoints(contour([220, oneSemitoneUp]), 220, 300, height);

    const drop = Math.abs(points[1]!.y - points[0]!.y);
    expect(drop).toBeCloseTo(height / MIN_SEMITONE_SPAN, 1);
  });

  it("places the baseline via RANGE_PADDING_SEMITONES — closed form, not a loose bound", () => {
    // Fix round 1, F1 — `0 < baselineY < 100` stayed green with the ±1
    // padding term deleted entirely (baselineY moves from ~70.64 to ~69.66,
    // both inside the window). 200Hz/300Hz relative to 220Hz spans ~7.03
    // semitones — comfortably wider than MIN_SEMITONE_SPAN=4, so the floor
    // never triggers and the padding term is the only thing left to
    // determine the placement, which this closed form pins exactly.
    expect(RANGE_PADDING_SEMITONES).toBe(1);
    const refHz = 220;
    const height = 100;

    const { baselineY } = toPlotPoints(contour([200, 300]), refHz, 300, height);

    const dataMin = hzToSemitones(200, refHz);
    const dataMax = hzToSemitones(300, refHz);
    const span = dataMax - dataMin + 2 * RANGE_PADDING_SEMITONES;
    expect(span).toBeGreaterThan(MIN_SEMITONE_SPAN); // confirms the floor is inactive here
    const expectedBaselineY = (height * (dataMax + RANGE_PADDING_SEMITONES)) / span;

    expect(baselineY).toBeCloseTo(expectedBaselineY, 5);
  });

  it("returns a point per frame even when nothing is voiced", () => {
    const { points } = toPlotPoints(contour([null, null]), 220, 300, 100);

    expect(points).toHaveLength(2);
    expect(points.every((p) => p === null)).toBe(true);
  });

  it("handles a zero-frame contour without throwing", () => {
    const { points, baselineY } = toPlotPoints(contour([]), 220, 300, 100);

    expect(points).toEqual([]);
    expect(baselineY).toBeGreaterThan(0);
    expect(baselineY).toBeLessThan(100);
  });

  it("places a single-frame contour at x=0 without dividing by zero", () => {
    const { points } = toPlotPoints(contour([200]), 220, 300, 100);

    expect(points).toHaveLength(1);
    expect(points[0]?.x).toBe(0);
    expect(Number.isFinite(points[0]?.y)).toBe(true);
  });
});
