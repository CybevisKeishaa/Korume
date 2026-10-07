import { describe, expect, it } from "vitest";
import { meaningFor } from "./meaning";

describe("meaningFor (spec §1.8, P6)", () => {
  it("serves the curated Vietnamese meaning in vi", () => {
    expect(meaningFor({ glossEn: "person", curatedVi: "người" }, "vi")).toEqual({ meaning: "người", meaningLocale: "vi", meaningSource: "curated" });
  });
  it("falls back to JMdict English, labelled en, when vi has no curated meaning", () => {
    expect(meaningFor({ glossEn: "person", curatedVi: null }, "vi")).toEqual({ meaning: "person", meaningLocale: "en", meaningSource: "jmdict" });
  });
  it("never returns the Vietnamese meaning to an en learner", () => {
    expect(meaningFor({ glossEn: "person", curatedVi: "người" }, "en")).toEqual({ meaning: "person", meaningLocale: "en", meaningSource: "jmdict" });
  });
});
