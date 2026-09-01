import { describe, expect, it } from "vitest";
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
    // fall — which is ONE inflection each. Reference `346:6275` draws roughly
    // 60-80 direction changes across the card's width. The band is wide
    // because the exact count is a consequence of the jitter tables, not a
    // design decision; what it forbids is the trace going smooth again.
    const counts = [inflections(hzOf(NATIVE_DEMO_CONTOUR)), inflections(hzOf(USER_DEMO_CONTOUR))];

    expect(counts).toHaveLength(2);
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(55);
      expect(count).toBeLessThanOrEqual(85);
    }
  });

  it("breaks exactly once, at the phrase break — not at either end", () => {
    for (const [name, contour] of [
      ["native", NATIVE_DEMO_CONTOUR],
      ["you", USER_DEMO_CONTOUR],
    ] as const) {
      const hz = hzOf(contour);
      const runs = voicedRuns(hz);

      expect(runs, name).toHaveLength(2);
      const first = must(runs[0], `${name} first voiced run`);
      const second = must(runs[1], `${name} second voiced run`);
      // A gap at either end would be trimmed away by the renderer and show
      // nothing; the break has to sit between the two accent phrases.
      expect(first.start, name).toBe(0);
      expect(second.end, name).toBe(hz.length);
      expect(first.end, name).toBeLessThan(second.start);
    }
  });

  it("reads as 日本の秋はとても美しいですね。 — rise, peak on とても, fall", () => {
    const hz = hzOf(NATIVE_DEMO_CONTOUR).map((v) => v ?? Number.NaN);
    const runs = voicedRuns(hzOf(NATIVE_DEMO_CONTOUR));
    expect(runs).toHaveLength(2);
    const first = must(runs[0], "first accent phrase");
    const second = must(runs[1], "second accent phrase");

    // 日本の秋は rises: the first phrase ends higher than it begins.
    const at = (i: number) => must(hz[i], `frame ${i}`);
    expect(at(first.end - 1)).toBeGreaterThan(at(first.start));

    // The phrase's high point falls in とても — inside the first third of the
    // second accent phrase. とても美しいですね is ELEVEN morae (と て も う つ
    // く し い で す ね), so a third of it is とても plus a fraction of う;
    // "three morae of nine" here was simply wrong about the sentence (fix
    // round 1, F7). The window is still tight enough to exclude 秋, which is
    // where the mutation check moves the peak to.
    const peak = Math.max(...hz.filter((v) => !Number.isNaN(v)));
    const peakIndex = hz.indexOf(peak);
    const totemoEnd = second.start + (second.end - second.start) / 3;
    expect(peakIndex).toBeGreaterThanOrEqual(second.start);
    expect(peakIndex).toBeLessThan(totemoEnd);

    // …and 美しいですね falls away from it: the trough of the second phrase
    // sits well below the peak, and the closing ね lift stays under it.
    const tail = hz.slice(peakIndex, second.end);
    expect(Math.min(...tail)).toBeLessThan(peak - 40);
    expect(at(second.end - 1)).toBeLessThan(peak);
  });

  it("makes the You track FLATTEN the peak — the error the real scorer surfaces", () => {
    const native = hzOf(NATIVE_DEMO_CONTOUR).filter((v): v is number => v !== null);
    const user = hzOf(USER_DEMO_CONTOUR).filter((v): v is number => v !== null);

    expect(native.length).toBeGreaterThan(100);
    expect(user).toHaveLength(native.length);

    // Not merely a noisy variant: the user's high point is far below the
    // native's, which is what the Companion's feedback in §4 is about.
    expect(Math.max(...user)).toBeLessThan(Math.max(...native) - 20);
  });
});
