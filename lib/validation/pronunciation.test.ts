import { describe, expect, it } from "vitest";
import { pronunciationScoreFieldsSchema } from "./pronunciation";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("pronunciationScoreFieldsSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = pronunciationScoreFieldsSchema.safeParse({ referenceText: "今日はいい天気です" });
    expect(result.success).toBe(true);
  });

  it("accepts an optional shadowingSessionId", () => {
    const result = pronunciationScoreFieldsSchema.safeParse({
      referenceText: "今日はいい天気です",
      shadowingSessionId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid shadowingSessionId", () => {
    const result = pronunciationScoreFieldsSchema.safeParse({
      referenceText: "今日はいい天気です",
      shadowingSessionId: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty referenceText", () => {
    expect(pronunciationScoreFieldsSchema.safeParse({ referenceText: "" }).success).toBe(false);
  });

  it("rejects a referenceText over 500 characters", () => {
    expect(
      pronunciationScoreFieldsSchema.safeParse({ referenceText: "あ".repeat(501) }).success,
    ).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = pronunciationScoreFieldsSchema.parse({ referenceText: "  こんにちは  " });
    expect(result.referenceText).toBe("こんにちは");
  });

  it("rejects a missing referenceText", () => {
    expect(pronunciationScoreFieldsSchema.safeParse({}).success).toBe(false);
  });
});
