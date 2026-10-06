import { describe, expect, it } from "vitest";
import viCatalog from "@/messages/vi/vocab.json";
import enCatalog from "@/messages/en/vocab.json";
import { QUOTE_COUNT, quoteKey } from "./quotes";

describe("printQuote (spec W W10)", () => {
  it("is deterministic by page index and cycles through every curated prompt", () => {
    expect(quoteKey(0)).toBe("quotes.q1");
    expect(quoteKey(7)).toBe("quotes.q8");
    expect(quoteKey(8)).toBe("quotes.q1");
    expect(quoteKey(3)).toBe(quoteKey(3 + QUOTE_COUNT));
  });
  it("has exactly QUOTE_COUNT prompts in each locale", () => {
    expect(Object.keys(viCatalog.print.quotes)).toHaveLength(QUOTE_COUNT);
    expect(Object.keys(enCatalog.print.quotes)).toHaveLength(QUOTE_COUNT);
  });
});
