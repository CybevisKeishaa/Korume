import { describe, expect, it } from "vitest";
import { videoRemainingSeconds } from "./video-remaining";

const lines = [{ startTime: 0, endTime: 60 }, { startTime: 120, endTime: 180 }, { startTime: 540, endTime: 600 }];

describe("videoRemainingSeconds (WP spec §3.7)", () => {
  it("is the video's duration minus the current sentence's start", () => {
    expect(videoRemainingSeconds(lines, 0, 900)).toBe(900);
    expect(videoRemainingSeconds(lines, 1, 900)).toBe(780);
  });
  it("falls back to the last line's end when the duration is unknown", () => {
    expect(videoRemainingSeconds(lines, 1, null)).toBe(480);
  });
  it("is null with no current sentence, or no end known at all", () => {
    expect(videoRemainingSeconds(lines, null, 900)).toBeNull();
    expect(videoRemainingSeconds([{ startTime: 0, endTime: null }], 0, null)).toBeNull();
    expect(videoRemainingSeconds([], 0, 900)).toBeNull();
  });
  it("never goes below zero", () => {
    expect(videoRemainingSeconds(lines, 2, 500)).toBe(0);
  });
});
