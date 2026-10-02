import { describe, expect, it } from "vitest";
import { SERVER_WRITE_INTERVAL_MS, shouldWriteServer } from "./progress-coalescer";

describe("shouldWriteServer", () => {
  it("coalesces ticks by time and meaningful distance", () => {
    expect(shouldWriteServer(null, 1, 0, "tick")).toBe(true);
    expect(shouldWriteServer(null, Number.NaN, 0, "pause")).toBe(false);
    expect(shouldWriteServer(null, 0, 0, "tick")).toBe(false);
    expect(shouldWriteServer({ position: 10, at: 100 }, 13, 5_100, "tick")).toBe(false);
    expect(shouldWriteServer({ position: 10, at: 100 }, 10.4, 100 + SERVER_WRITE_INTERVAL_MS, "tick")).toBe(false);
    expect(shouldWriteServer({ position: 10, at: 100 }, 13, 100 + SERVER_WRITE_INTERVAL_MS, "tick")).toBe(true);
  });

  it("writes non-ending lifecycle events only for meaningful change", () => {
    for (const reason of ["pause", "hidden", "pagehide", "leave"] as const) {
      expect(shouldWriteServer({ position: 10, at: 100 }, 10.05, 101, reason)).toBe(true);
      expect(shouldWriteServer({ position: 10, at: 100 }, 10.04, 101, reason)).toBe(false);
      expect(shouldWriteServer(null, 0, 101, reason)).toBe(true);
    }
    expect(shouldWriteServer({ position: 10, at: 100 }, 10, 101, "ended")).toBe(true);
  });
});
