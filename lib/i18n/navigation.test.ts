import { describe, expect, it } from "vitest";
import { getPathname } from "./navigation";
import { routing } from "./routing";

describe("navigation", () => {
  it("prefixes generated paths for every locale, including the default", () => {
    for (const locale of routing.locales) {
      expect(getPathname({ href: "/foo", locale })).toBe(`/${locale}/foo`);
    }
  });

  it("prefixes the root path", () => {
    expect(getPathname({ href: "/", locale: routing.defaultLocale })).toBe(
      `/${routing.defaultLocale}`,
    );
  });
});
