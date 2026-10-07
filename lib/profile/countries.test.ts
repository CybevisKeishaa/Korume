import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, isCountryCode } from "./countries";

describe("countries", () => {
  it("accepts upper-case ISO codes only", () => {
    expect(isCountryCode("VN")).toBe(true);
    expect(isCountryCode("vn")).toBe(false);
    expect(isCountryCode("XX")).toBe(false);
    expect(isCountryCode("ZZZ")).toBe(false);
  });

  it("holds the 249 ISO 3166-1 alpha-2 codes, unique", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    for (const code of ["VN", "JP", "US", "KR", "TW", "TH"]) expect(COUNTRY_CODES).toContain(code);
  });

  it("every code has a display name (a typo comes back as the code itself)", () => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const unnamed = COUNTRY_CODES.filter((code) => names.of(code) === code);
    expect(unnamed).toEqual([]);
  });
});
