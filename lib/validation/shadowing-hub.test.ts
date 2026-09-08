import { describe, expect, it } from "vitest";
import { shadowingHubQuerySchema } from "./shadowing-hub";

describe("shadowingHubQuerySchema", () => {
  it("normalizes a bounded search query and a two-axis filter", () => {
    expect(shadowingHubQuerySchema.parse({ q: "  restaurant  ", filter: "source:anime" })).toEqual({
      q: "restaurant",
      filter: "source:anime",
    });
  });

  it("rejects unknown filter axes and overlong search strings", () => {
    expect(shadowingHubQuerySchema.safeParse({ filter: "level:N3" }).success).toBe(false);
    expect(shadowingHubQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});
