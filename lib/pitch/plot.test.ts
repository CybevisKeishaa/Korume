import { describe, expect, it } from "vitest";
import {
  toPlotPoints,
  toSemitones,
  semitoneRange,
  MIN_SEMITONE_SPAN,
  RANGE_PADDING_SEMITONES,
} from "./plot";
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

describe("semitoneRange", () => {
  it("pads the observed range by RANGE_PADDING_SEMITONES on each side", () => {
    const range = semitoneRange([0, 6]);

    expect(range.min).toBeCloseTo(-RANGE_PADDING_SEMITONES, 10);
    expect(range.max).toBeCloseTo(6 + RANGE_PADDING_SEMITONES, 10);
  });

  it("widens a nearly-flat set to MIN_SEMITONE_SPAN, centred on the data", () => {
    const range = semitoneRange([2, 2.5]);

    expect(range.max - range.min).toBeCloseTo(MIN_SEMITONE_SPAN, 10);
    expect((range.max + range.min) / 2).toBeCloseTo(2.25, 10);
  });

  it("ignores unvoiced entries and survives an all-unvoiced set", () => {
    expect(semitoneRange([null, 0, null, 6])).toEqual(semitoneRange([0, 6]));

    const empty = semitoneRange([null, null]);
    expect(empty.max - empty.min).toBeCloseTo(MIN_SEMITONE_SPAN, 10);
  });
});

describe("toSemitones", () => {
  it("converts each frame relative to refHz and preserves gaps positionally", () => {
    const values = toSemitones(contour([220, null, 440]), 220);

    expect(values).toHaveLength(3);
    expect(values[0]).toBeCloseTo(0, 10);
    expect(values[1]).toBeNull();
    expect(values[2]).toBeCloseTo(12, 10);
  });
});

describe("toPlotPoints with a shared range", () => {
  it("draws two takes in proportion to each other, which per-take normalization cannot", () => {
    // The defect this argument exists to fix. `flat` moves EXACTLY HALF as far
    // as `wide` — 6 semitones against 12 — so an honest overlay draws it half
    // as tall. Normalized to its own range it is drawn at 7/8 the height
    // instead, because each window costs the same fixed
    // RANGE_PADDING_SEMITONES however much the take actually moved. That is
    // how §4 came to show a flattened "You" track at nearly the native's
    // amplitude.
    const base = 200;
    const refHz = 200;
    const height = 100;
    const wide = contour([base, base * 2 ** (12 / 12)]);
    const flat = contour([base, base * 2 ** (6 / 12)]);
    const spanOf = (c: PitchContour, range?: { min: number; max: number }) => {
      const ys = toPlotPoints(c, refHz, 300, height, range)
        .points.filter((p): p is { x: number; y: number } => p !== null)
        .map((p) => p.y);
      return Math.max(...ys) - Math.min(...ys);
    };

    // Independently normalized: 12/(12+2) against 6/(6+2) — 0.875, not 0.5.
    expect(spanOf(flat) / spanOf(wide)).toBeCloseTo(0.875, 6);

    const shared = semitoneRange([...toSemitones(wide, refHz), ...toSemitones(flat, refHz)]);
    expect(spanOf(flat, shared) / spanOf(wide, shared)).toBeCloseTo(0.5, 6);
  });

  it("leaves the derived-range behaviour untouched when no range is passed", () => {
    const c = contour([200, 300]);

    expect(toPlotPoints(c, 220, 300, 100)).toEqual(
      toPlotPoints(c, 220, 300, 100, semitoneRange(toSemitones(c, 220))),
    );
  });
});
