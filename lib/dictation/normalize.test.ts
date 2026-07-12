import { describe, expect, it } from "vitest";
import { normalizeJa } from "./normalize";

describe("normalizeJa", () => {
  it("trims and collapses/strips whitespace (Japanese has no meaningful spacing)", () => {
    expect(normalizeJa("  今日は  良い 天気  ")).toBe("今日は良い天気");
    expect(normalizeJa("a\t b\n c")).toBe("abc");
  });

  it("normalizes full-width alphanumerics to half-width via NFKC", () => {
    expect(normalizeJa("Ａ１２３")).toBe("A123");
  });

  it("normalizes half-width katakana to full-width via NFKC", () => {
    expect(normalizeJa("ｶﾀｶﾅ")).toBe("カタカナ");
  });

  it("leaves already-normalized Japanese text unchanged (aside from spacing)", () => {
    expect(normalizeJa("今日は良い天気ですね")).toBe("今日は良い天気ですね");
  });

  it("returns an empty string for empty or all-whitespace input", () => {
    expect(normalizeJa("")).toBe("");
    expect(normalizeJa("   \n\t ")).toBe("");
  });
});
