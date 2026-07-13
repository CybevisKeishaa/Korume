import { describe, expect, it } from "vitest";
import { readingQuerySchema, readingSubmitSchema } from "./reading";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("readingQuerySchema", () => {
  it("accepts an absent level", () => {
    expect(readingQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid level", () => {
    expect(readingQuerySchema.safeParse({ level: "N4" }).success).toBe(true);
  });

  it("rejects an invalid level", () => {
    expect(readingQuerySchema.safeParse({ level: "N6" }).success).toBe(false);
  });
});

describe("readingSubmitSchema", () => {
  it("accepts a valid answers map", () => {
    expect(readingSubmitSchema.safeParse({ answers: { [UUID]: "0" } }).success).toBe(true);
  });

  it("accepts an empty answers object", () => {
    expect(readingSubmitSchema.safeParse({ answers: {} }).success).toBe(true);
  });

  it("rejects a non-uuid answer key", () => {
    expect(readingSubmitSchema.safeParse({ answers: { nope: "0" } }).success).toBe(false);
  });

  it("rejects an out-of-range answer value", () => {
    expect(readingSubmitSchema.safeParse({ answers: { [UUID]: "9" } }).success).toBe(false);
  });

  it("rejects a missing answers field", () => {
    expect(readingSubmitSchema.safeParse({}).success).toBe(false);
  });
});
