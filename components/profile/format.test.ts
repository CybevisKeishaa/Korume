import { describe, expect, it } from "vitest";
import { formatStudyDuration } from "./format";

describe("formatStudyDuration", () => {
  it("floors to whole minutes, never rounds up", () => {
    expect(formatStudyDuration(5 * 3600 + 20 * 60 + 59)).toEqual({ hours: 5, minutes: 20 });
  });
  it("renders zero and tolerates negatives", () => {
    expect(formatStudyDuration(0)).toEqual({ hours: 0, minutes: 0 });
    expect(formatStudyDuration(-5)).toEqual({ hours: 0, minutes: 0 });
  });
});
