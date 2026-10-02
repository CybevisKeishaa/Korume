import { describe, expect, it } from "vitest";
import { retryAfterFor } from "./backoff";

describe("retryAfterFor", () => {
  const now = new Date("2026-10-02T00:00:00.000Z");
  it.each([
    [1, 30_000],
    [2, 120_000],
    [3, 600_000],
    [9, 600_000],
  ])("waits after attempt %i for %i ms", (attempts, ms) => {
    expect(retryAfterFor(attempts, now).getTime() - now.getTime()).toBe(ms);
  });
});
