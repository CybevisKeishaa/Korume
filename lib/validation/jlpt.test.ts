import { describe, expect, it } from "vitest";
import { jlptAttemptsQuerySchema, jlptSubmitSchema, jlptTestsQuerySchema } from "./jlpt";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "660e8400-e29b-41d4-a716-446655440001";

describe("jlptTestsQuerySchema", () => {
  it("accepts an absent level", () => {
    expect(jlptTestsQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid level", () => {
    expect(jlptTestsQuerySchema.safeParse({ level: "N5" }).success).toBe(true);
  });

  it("rejects an invalid level", () => {
    expect(jlptTestsQuerySchema.safeParse({ level: "N6" }).success).toBe(false);
  });
});

describe("jlptAttemptsQuerySchema", () => {
  it("accepts an absent testId", () => {
    expect(jlptAttemptsQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid uuid testId", () => {
    expect(jlptAttemptsQuerySchema.safeParse({ testId: UUID }).success).toBe(true);
  });

  it("rejects a non-uuid testId", () => {
    expect(jlptAttemptsQuerySchema.safeParse({ testId: "nope" }).success).toBe(false);
  });
});

describe("jlptSubmitSchema", () => {
  it("accepts a full-mode submission with no section", () => {
    const result = jlptSubmitSchema.safeParse({
      answers: { [UUID]: "0", [UUID2]: "2" },
      mode: "full",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty answers object", () => {
    expect(jlptSubmitSchema.safeParse({ answers: {}, mode: "full" }).success).toBe(true);
  });

  it("accepts a section-mode submission with a section", () => {
    const result = jlptSubmitSchema.safeParse({
      answers: { [UUID]: "1" },
      mode: "section",
      section: "vocab",
    });
    expect(result.success).toBe(true);
  });

  it("rejects section-mode without a section", () => {
    const result = jlptSubmitSchema.safeParse({
      answers: { [UUID]: "1" },
      mode: "section",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional started_at ISO datetime", () => {
    const result = jlptSubmitSchema.safeParse({
      answers: {},
      mode: "full",
      started_at: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid answer key", () => {
    const result = jlptSubmitSchema.safeParse({
      answers: { "not-a-uuid": "0" },
      mode: "full",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range answer value", () => {
    const result = jlptSubmitSchema.safeParse({
      answers: { [UUID]: "4" },
      mode: "full",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid mode", () => {
    const result = jlptSubmitSchema.safeParse({
      answers: {},
      mode: "half",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid section", () => {
    const result = jlptSubmitSchema.safeParse({
      answers: {},
      mode: "section",
      section: "kanji",
    });
    expect(result.success).toBe(false);
  });
});
