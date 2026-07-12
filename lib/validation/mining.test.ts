import { describe, expect, it } from "vitest";
import { createMiningCardSchema, miningQueueQuerySchema, reviewMiningCardSchema } from "./mining";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createMiningCardSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createMiningCardSchema.safeParse({ lineId: UUID, targetWord: "食べる" });
    expect(result.success).toBe(true);
  });

  it("accepts an optional reading and translation", () => {
    const result = createMiningCardSchema.safeParse({
      lineId: UUID,
      targetWord: "食べる",
      reading: "たべる",
      sentenceTranslation: "to eat",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid lineId", () => {
    const result = createMiningCardSchema.safeParse({ lineId: "not-a-uuid", targetWord: "食べる" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty target word", () => {
    const result = createMiningCardSchema.safeParse({ lineId: UUID, targetWord: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a target word over 50 characters", () => {
    const result = createMiningCardSchema.safeParse({ lineId: UUID, targetWord: "あ".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejects a reading over 50 characters", () => {
    const result = createMiningCardSchema.safeParse({
      lineId: UUID,
      targetWord: "食べる",
      reading: "あ".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a translation over 500 characters", () => {
    const result = createMiningCardSchema.safeParse({
      lineId: UUID,
      targetWord: "食べる",
      sentenceTranslation: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing targetWord", () => {
    const result = createMiningCardSchema.safeParse({ lineId: UUID });
    expect(result.success).toBe(false);
  });
});

describe("reviewMiningCardSchema", () => {
  it("accepts a valid cardId/quality pair", () => {
    const result = reviewMiningCardSchema.safeParse({ cardId: UUID, quality: 4 });
    expect(result.success).toBe(true);
  });

  it.each([0, 1, 2, 3, 4, 5])("accepts quality %i", (quality) => {
    expect(reviewMiningCardSchema.safeParse({ cardId: UUID, quality }).success).toBe(true);
  });

  it("rejects quality below 0", () => {
    expect(reviewMiningCardSchema.safeParse({ cardId: UUID, quality: -1 }).success).toBe(false);
  });

  it("rejects quality above 5", () => {
    expect(reviewMiningCardSchema.safeParse({ cardId: UUID, quality: 6 }).success).toBe(false);
  });

  it("rejects a non-integer quality", () => {
    expect(reviewMiningCardSchema.safeParse({ cardId: UUID, quality: 2.5 }).success).toBe(false);
  });

  it("rejects a non-uuid cardId", () => {
    expect(reviewMiningCardSchema.safeParse({ cardId: "nope", quality: 3 }).success).toBe(false);
  });
});

describe("miningQueueQuerySchema", () => {
  it("defaults limit to 20 when absent", () => {
    const result = miningQueueQuerySchema.parse({});
    expect(result.limit).toBe(20);
  });

  it("coerces a string query param to a number", () => {
    const result = miningQueueQuerySchema.parse({ limit: "5" });
    expect(result.limit).toBe(5);
  });

  it("rejects a limit above 100", () => {
    expect(miningQueueQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("rejects a limit below 1", () => {
    expect(miningQueueQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });
});
