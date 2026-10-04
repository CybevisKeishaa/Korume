import { describe, expect, it } from "vitest";
import { normalizeRef } from "./refs";

describe("normalizeRef", () => {
  it("is NFKC + trim, so width variants and stray spaces share one identity", () => {
    expect(normalizeRef(" ｺｰﾋｰ ")).toBe("コーヒー");
    expect(normalizeRef("注文")).toBe("注文");
    expect(normalizeRef("𠮷野家")).toBe("𠮷野家");
  });
});
