import { describe, expect, it } from "vitest";
import { normalizeTurnText, threadTitle } from "./text";

describe("normalizeTurnText", () => {
  it("trims, collapses whitespace and composes to NFC", () => {
    expect(normalizeTurnText("  は\n\n は  ")).toBe("は は");
    expect(normalizeTurnText("か\u3099")).toBe("が");
  });
});

describe("threadTitle", () => {
  it("keeps a short question and cuts a long one at 40 code points", () => {
    expect(threadTitle("Why is は pronounced wa?")).toBe("Why is は pronounced wa?");
    expect(threadTitle("x".repeat(40))).toBe("x".repeat(40));
    expect(threadTitle("x".repeat(41))).toBe("x".repeat(40) + "…");
    expect(threadTitle("𠮷".repeat(41))).toBe("𠮷".repeat(40) + "…");
  });
});
