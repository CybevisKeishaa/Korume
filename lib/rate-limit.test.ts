import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows hits up to the limit within the window", () => {
    const key = "test:allow-under-limit";
    expect(rateLimit(key, { limit: 3, windowMs: 1000 }, 0).ok).toBe(true);
    expect(rateLimit(key, { limit: 3, windowMs: 1000 }, 10).ok).toBe(true);
    expect(rateLimit(key, { limit: 3, windowMs: 1000 }, 20).ok).toBe(true);
  });

  it("blocks the hit that exceeds the limit and reports retryAfter", () => {
    const key = "test:block-over-limit";
    rateLimit(key, { limit: 2, windowMs: 1000 }, 0);
    rateLimit(key, { limit: 2, windowMs: 1000 }, 100);
    const blocked = rateLimit(key, { limit: 2, windowMs: 1000 }, 200);
    expect(blocked.ok).toBe(false);
    // Oldest hit (t=0) expires at t=1000; now=200 -> retryAfter=800.
    expect(blocked.retryAfter).toBe(800);
  });

  it("evicts hits once they age out of the window, admitting new ones", () => {
    const key = "test:sliding-window";
    rateLimit(key, { limit: 1, windowMs: 1000 }, 0);

    const stillBlocked = rateLimit(key, { limit: 1, windowMs: 1000 }, 999);
    expect(stillBlocked.ok).toBe(false);

    const allowedAfterWindow = rateLimit(key, { limit: 1, windowMs: 1000 }, 1000);
    expect(allowedAfterWindow.ok).toBe(true);
  });

  it("tracks separate keys independently", () => {
    rateLimit("test:key-a", { limit: 1, windowMs: 1000 }, 0);
    const other = rateLimit("test:key-b", { limit: 1, windowMs: 1000 }, 0);
    expect(other.ok).toBe(true);
  });

  it("keeps blocking while requests keep arriving inside the window", () => {
    const key = "test:repeated-block";
    rateLimit(key, { limit: 1, windowMs: 1000 }, 0);
    const first = rateLimit(key, { limit: 1, windowMs: 1000 }, 100);
    const second = rateLimit(key, { limit: 1, windowMs: 1000 }, 500);
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    // The blocked calls must not themselves consume budget: retryAfter keeps
    // counting down from the original hit at t=0, not from t=100.
    expect(first.retryAfter).toBe(900);
    expect(second.retryAfter).toBe(500);
  });

  it("defaults now to the real clock when omitted", () => {
    const key = "test:default-now";
    const result = rateLimit(key, { limit: 5, windowMs: 1000 });
    expect(result.ok).toBe(true);
    expect(result.retryAfter).toBe(0);
  });
});
