import { describe, expect, it } from "vitest";
import { shadowingExploreQuerySchema } from "./shadowing-explore";

describe("shadowingExploreQuerySchema", () => {
  it("normalizes a bounded search term and URL-safe situation slug", () => {
    expect(shadowingExploreQuerySchema.parse({ q: "  restaurant  ", situation: "daily-life" })).toEqual({
      q: "restaurant",
      situation: "daily-life",
    });
  });

  it("rejects overlong terms and unsafe query parameters before they reach the catalogue", () => {
    expect(shadowingExploreQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(shadowingExploreQuerySchema.safeParse({ situation: "restaurant;drop" }).success).toBe(false);
  });
});
