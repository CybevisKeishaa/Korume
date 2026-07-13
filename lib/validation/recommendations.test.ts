import { describe, expect, it } from "vitest";
import { recommendationsQuerySchema } from "./recommendations";

describe("recommendationsQuerySchema", () => {
  it("defaults limit to 12 when absent", () => {
    const result = recommendationsQuerySchema.parse({});
    expect(result.limit).toBe(12);
  });

  it("coerces a string query param to a number", () => {
    const result = recommendationsQuerySchema.parse({ limit: "5" });
    expect(result.limit).toBe(5);
  });

  it("accepts a limit of exactly 24", () => {
    expect(recommendationsQuerySchema.safeParse({ limit: "24" }).success).toBe(true);
  });

  it("rejects a limit above 24", () => {
    expect(recommendationsQuerySchema.safeParse({ limit: "25" }).success).toBe(false);
  });

  it("rejects a limit below 1", () => {
    expect(recommendationsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });
});
