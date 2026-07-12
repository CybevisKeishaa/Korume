import { describe, expect, it } from "vitest";
import { hzToSemitones, medianVoicedHz, medianFilter, buildContour } from "./contour";
import type { F0Frame } from "./types";

function frame(time: number, hz: number | null): F0Frame {
  return { time, hz };
}

describe("hzToSemitones", () => {
  it("is 0 at the reference", () => {
    expect(hzToSemitones(220, 220)).toBe(0);
  });

  it("is +12 one octave up and -12 one octave down", () => {
    expect(hzToSemitones(440, 220)).toBeCloseTo(12, 10);
    expect(hzToSemitones(110, 220)).toBeCloseTo(-12, 10);
  });

  it("is ~+7 for a perfect fifth (3:2)", () => {
    expect(hzToSemitones(330, 220)).toBeCloseTo(7.02, 2);
  });

  it("rejects non-positive inputs", () => {
    expect(() => hzToSemitones(0, 220)).toThrow(RangeError);
    expect(() => hzToSemitones(220, 0)).toThrow(RangeError);
    expect(() => hzToSemitones(-100, 220)).toThrow(RangeError);
  });
});

describe("medianVoicedHz", () => {
  it("returns the median of voiced frames, ignoring nulls", () => {
    const frames = [frame(0, 100), frame(1, null), frame(2, 200), frame(3, 300)];
    expect(medianVoicedHz(frames)).toBe(200);
  });

  it("averages the two middle values for an even count", () => {
    expect(medianVoicedHz([frame(0, 100), frame(1, 200)])).toBe(150);
  });

  it("returns null when there are no voiced frames", () => {
    expect(medianVoicedHz([frame(0, null), frame(1, null)])).toBeNull();
    expect(medianVoicedHz([])).toBeNull();
  });
});

describe("medianFilter", () => {
  it("removes a single-frame octave spike", () => {
    // A lone 400 Hz jump among ~200 Hz frames is flattened by the median.
    const frames = [
      frame(0, 200),
      frame(1, 200),
      frame(2, 400), // spike
      frame(3, 200),
      frame(4, 200),
    ];
    const out = medianFilter(frames, 3);
    expect(out[2]?.hz).toBe(200);
  });

  it("preserves unvoiced (null) frames as null", () => {
    const frames = [frame(0, 200), frame(1, null), frame(2, 200)];
    const out = medianFilter(frames, 3);
    expect(out[1]?.hz).toBeNull();
  });

  it("keeps a voiced frame's own value when it has no voiced neighbours", () => {
    const frames = [frame(0, null), frame(1, 250), frame(2, null)];
    const out = medianFilter(frames, 3);
    expect(out[1]?.hz).toBe(250);
  });

  it("preserves times and length", () => {
    const frames = [frame(0.1, 200), frame(0.2, 210), frame(0.3, 205)];
    const out = medianFilter(frames, 3);
    expect(out.map((f) => f.time)).toEqual([0.1, 0.2, 0.3]);
    expect(out.length).toBe(3);
  });

  it("rounds an even window up to the next odd size", () => {
    // window 4 -> 5: the centre frame sees ±2 neighbours. Spike at index 2 is
    // outvoted by four 100s.
    const frames = [frame(0, 100), frame(1, 100), frame(2, 900), frame(3, 100), frame(4, 100)];
    const out = medianFilter(frames, 4);
    expect(out[2]?.hz).toBe(100);
  });

  it("rejects windowSize < 1", () => {
    expect(() => medianFilter([frame(0, 200)], 0)).toThrow(RangeError);
  });
});

describe("buildContour", () => {
  it("wraps frames with the sample rate", () => {
    const frames = [frame(0, 100), frame(1, 200)];
    const contour = buildContour(frames, 16000);
    expect(contour.sampleRate).toBe(16000);
    expect(contour.frames).toEqual(frames);
  });

  it("defensively copies frames (mutating the source does not affect the contour)", () => {
    const source = frame(0, 100);
    const contour = buildContour([source], 16000);
    source.hz = 999;
    expect(contour.frames[0]?.hz).toBe(100);
  });

  it("rejects a non-positive sample rate", () => {
    expect(() => buildContour([], 0)).toThrow(RangeError);
  });
});
