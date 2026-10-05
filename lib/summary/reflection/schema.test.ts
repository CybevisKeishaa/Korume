import { describe, expect, it } from "vitest";
import { FinalizeError } from "@/lib/knowledge/leased";
import { finalizeReflection } from "./schema";

const LINES = new Map([["R1", { id: "line-a", textJp: "ありがとうございました！" }]]);
const valid = (overrides: Record<string, unknown> = {}) => ({
  text: "You kept going until the end.", highlight_line_id: "R1", highlight_span: "ありがとうございました", ...overrides,
});

describe("finalizeReflection", () => {
  it("keeps a highlight that is really in its line, stored by the real line id", () => {
    expect(finalizeReflection(valid(), LINES)).toEqual({
      text: "You kept going until the end.", highlight: { lineId: "line-a", span: "ありがとうございました" },
    });
  });

  it("matches the highlight by NFKC substring", () => {
    expect(finalizeReflection(valid({ highlight_span: "ございました!" }), LINES).highlight).toEqual({ lineId: "line-a", span: "ございました!" });
  });

  it("drops a highlight that is not in the line, names an unknown line, or is empty, and keeps the text", () => {
    for (const overrides of [
      { highlight_span: "さようなら" }, { highlight_line_id: "R9" }, { highlight_line_id: "", highlight_span: "" },
    ]) {
      expect(finalizeReflection(valid(overrides), LINES)).toEqual({ text: "You kept going until the end.", highlight: null });
    }
  });

  it("refuses a digit, a Japanese quotation, an empty or overlong text, and an extra field", () => {
    for (const bad of [
      valid({ text: "You saved 3 words." }),
      valid({ text: "Nice 「ありがとう」 there." }),
      valid({ text: "Nice 『ありがとう』 there." }),
      valid({ text: "   " }),
      valid({ text: "a".repeat(401) }),
      valid({ score: 80 }),
    ]) {
      expect(() => finalizeReflection(bad, LINES), JSON.stringify(bad)).toThrow(FinalizeError);
    }
  });
});
