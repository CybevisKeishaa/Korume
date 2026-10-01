import { describe, expect, it } from "vitest";
import { effectiveEnd, locateSentence, nextTarget, previousTarget, sameSentencePosition } from "./sentence-lookup";
import type { WorkspaceLine } from "./types";

const lines: WorkspaceLine[] = [
  { id: "A", index: 0, startTime: 0, endTime: 3.55, textJp: "A", textTranslation: null, furigana: null },
  { id: "B", index: 1, startTime: 3.55, endTime: 5.09, textJp: "B", textTranslation: null, furigana: null },
  { id: "C", index: 2, startTime: 5.09, endTime: null, textJp: "C", textTranslation: null, furigana: null },
  { id: "D", index: 3, startTime: 9, endTime: 10, textJp: "D", textTranslation: null, furigana: null },
];

describe("sentence lookup", () => {
  it("locates boundaries, gaps, and out-of-range positions", () => {
    expect(locateSentence(lines, -1, 20)).toEqual({ index: null, isSpoken: false });
    expect(locateSentence(lines, 0, 20)).toEqual({ index: 0, isSpoken: true });
    expect(locateSentence(lines, 3.55, 20)).toEqual({ index: 1, isSpoken: true });
    expect(locateSentence(lines, 6, 20)).toEqual({ index: 2, isSpoken: true });
    expect(locateSentence(lines, 9.5, 20)).toEqual({ index: 3, isSpoken: true });
    expect(locateSentence(lines, 12, 20)).toEqual({ index: 3, isSpoken: false });
    expect(locateSentence(lines, 25, 20)).toEqual({ index: 3, isSpoken: false });
  });

  it("chooses the later canonical line at duplicate starts", () => {
    const duplicates = [...lines.slice(0, 1), { ...lines[1]!, id: "B2", index: 1, startTime: 4 }, { ...lines[2]!, index: 2, startTime: 4 }];
    expect(locateSentence(duplicates, 4, 20)).toEqual({ index: 2, isSpoken: true });
  });

  it("uses next start, duration, then infinity for missing ends", () => {
    expect(effectiveEnd(lines, 2, 20)).toBe(9);
    expect(effectiveEnd([{ ...lines[2]!, index: 0 }], 0, 20)).toBe(20);
    expect(effectiveEnd([{ ...lines[2]!, index: 0 }], 0, null)).toBe(Infinity);
  });

  it("uses the strict 1.5 second previous-target rule and next target", () => {
    expect(previousTarget(lines, 1, 5.55)).toBe(1);
    expect(previousTarget(lines, 1, 4.55)).toBe(0);
    expect(previousTarget(lines, 0, 1)).toBe(0);
    expect(previousTarget(lines, null, 1)).toBeNull();
    expect(previousTarget(lines, 3, 10.5)).toBe(2); // exactly 1.5 s into D: not "more than", so previous
    expect(nextTarget(lines, null)).toBe(0);
    expect(nextTarget([], null)).toBeNull();
    expect(nextTarget(lines, 2)).toBe(3);
    expect(nextTarget(lines, 3)).toBe(3);
  });

  it("compares both position fields", () => {
    expect(sameSentencePosition({ index: 1, isSpoken: true }, { index: 1, isSpoken: true })).toBe(true);
    expect(sameSentencePosition({ index: 1, isSpoken: true }, { index: 1, isSpoken: false })).toBe(false);
    expect(sameSentencePosition({ index: 1, isSpoken: true }, { index: 2, isSpoken: true })).toBe(false);
  });
});
