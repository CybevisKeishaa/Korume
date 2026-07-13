import { describe, expect, it } from "vitest";
import {
  generateVocabExamplesSchema,
  MAX_AI_EXAMPLES_PER_VOCAB,
  shouldGenerateMoreExamples,
} from "./vocab-examples";

describe("generateVocabExamplesSchema", () => {
  it("accepts an empty body (level optional)", () => {
    expect(generateVocabExamplesSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid level override", () => {
    expect(generateVocabExamplesSchema.safeParse({ level: "N2" }).success).toBe(true);
  });

  it("rejects an invalid level", () => {
    expect(generateVocabExamplesSchema.safeParse({ level: "N6" }).success).toBe(false);
  });
});

describe("shouldGenerateMoreExamples", () => {
  it("allows generation when no examples exist yet", () => {
    expect(shouldGenerateMoreExamples(0)).toBe(true);
  });

  it("allows generation while under the cap", () => {
    expect(shouldGenerateMoreExamples(MAX_AI_EXAMPLES_PER_VOCAB - 1)).toBe(true);
  });

  it("blocks generation once the cap is reached", () => {
    expect(shouldGenerateMoreExamples(MAX_AI_EXAMPLES_PER_VOCAB)).toBe(false);
  });

  it("blocks generation past the cap", () => {
    expect(shouldGenerateMoreExamples(MAX_AI_EXAMPLES_PER_VOCAB + 5)).toBe(false);
  });

  it("honors a custom cap", () => {
    expect(shouldGenerateMoreExamples(2, 3)).toBe(true);
    expect(shouldGenerateMoreExamples(3, 3)).toBe(false);
  });
});
