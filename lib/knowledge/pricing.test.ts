import { describe, expect, it } from "vitest";
import { creditsFor, estimateCostUsd, upperBoundCostUsd, upperBoundCostUsdForTier } from "./pricing";

describe("pricing", () => {
  it("prices Claude Haiku 4.5 per million tokens, cache reads separately", () => {
    expect(
      estimateCostUsd("claude-haiku-4-5-20251001", { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 }),
    ).toBeCloseTo(1 + 5 + 0.1, 10);
    expect(estimateCostUsd("claude-haiku-4-5-20251001", { inputTokens: 2000, outputTokens: 500, cacheReadTokens: 0 })).toBeCloseTo(
      0.0045,
      10,
    );
  });

  it("prices Gemini at its free tier, which only runs outside production", () => {
    expect(estimateCostUsd("gemini-2.5-flash", { inputTokens: 5000, outputTokens: 5000, cacheReadTokens: 0 })).toBe(0);
    expect(upperBoundCostUsd("gemini", 5000, 1000)).toBe(0);
  });

  it("refuses to price an unknown model instead of calling it free", () => {
    expect(() => estimateCostUsd("claude-mystery", { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 })).toThrow(/no price/);
    expect(() => upperBoundCostUsd("none", 1, 1)).toThrow(/no price/);
  });

  it("bounds a call by its full input and its maximum output", () => {
    expect(upperBoundCostUsd("anthropic", 3000, 800)).toBeCloseTo((3000 * 1 + 800 * 5) / 1_000_000, 10);
  });

  it("bounds each tier with its provider model price", () => {
    expect(upperBoundCostUsdForTier("anthropic", "deep", 1_000_000, 1_000_000)).toBe(30);
    expect(upperBoundCostUsdForTier("anthropic", "fast", 1_000_000, 0)).toBe(1);
    expect(upperBoundCostUsdForTier("gemini", "deep", 1_000_000, 1_000_000)).toBe(0);
    expect(upperBoundCostUsd("anthropic", 1_000_000, 0)).toBe(1);
  });

  it("prices Opus 4.8 actual input, output and cache reads", () => {
    expect(estimateCostUsd("claude-opus-4-8", {
      inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000,
    })).toBe(30.5);
  });

  it.each([
    [0, 0],
    [0.000001, 1],
    [0.001, 1],
    [0.0011, 2],
    [0.0045, 5],
  ])("turns $%f into %i credits at $0.001 a credit", (cost, credits) => {
    expect(creditsFor(cost, 0.001)).toBe(credits);
  });
});
