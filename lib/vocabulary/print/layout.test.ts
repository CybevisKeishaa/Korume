import { describe, expect, it } from "vitest";
import { WRITING, writingLayout } from "./layout";

describe("writingLayout (spec W §3.1, W8)", () => {
  it("fits whole groups only: groupsPerRow = floor((W + gap) / (n·cell + gap))", () => {
    expect(WRITING.contentWidthMm).toBe(182);
    expect(writingLayout(1, "practice", "airy")).toEqual({ cellMm: 12, groupsPerRow: 12, rows: 2, repetitions: 24, oversized: false });
    expect(writingLayout(2, "practice", "compact")).toEqual({ cellMm: 12, groupsPerRow: 6, rows: 1, repetitions: 6, oversized: false });
    expect(writingLayout(4, "selfTest", "compact").groupsPerRow).toBe(3); // floor(185 / 51)
  });
  it("adds rows until the minimum repetitions fit (practice 3, self-test 2)", () => {
    expect(writingLayout(8, "practice", "compact")).toMatchObject({ groupsPerRow: 1, rows: 3, repetitions: 3 });
    expect(writingLayout(8, "selfTest", "compact")).toMatchObject({ groupsPerRow: 1, rows: 2 });
  });
  it("shrinks a group wider than W down to the 8mm floor, then reports it oversized", () => {
    expect(writingLayout(20, "practice", "airy")).toMatchObject({ cellMm: 9.1, groupsPerRow: 1, oversized: false });
    expect(writingLayout(23, "practice", "airy")).toMatchObject({ cellMm: 8, oversized: true });
  });
});
