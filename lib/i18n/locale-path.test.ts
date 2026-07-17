import { describe, expect, it } from "vitest";
import { stripLocale } from "./locale-path";
import { routing } from "./routing";

describe("stripLocale", () => {
  it("strips a known locale prefix", () => {
    expect(stripLocale("/vi/dashboard")).toEqual({
      locale: "vi",
      pathname: "/dashboard",
    });
    expect(stripLocale("/en/videos/abc/shadowing")).toEqual({
      locale: "en",
      pathname: "/videos/abc/shadowing",
    });
  });

  it("maps a bare locale root to /", () => {
    expect(stripLocale("/vi")).toEqual({ locale: "vi", pathname: "/" });
    expect(stripLocale("/en/")).toEqual({ locale: "en", pathname: "/" });
  });

  it("leaves an unprefixed pathname alone", () => {
    expect(stripLocale("/dashboard")).toEqual({
      locale: null,
      pathname: "/dashboard",
    });
    expect(stripLocale("/")).toEqual({ locale: null, pathname: "/" });
  });

  it("does not strip a segment that merely starts with a locale code", () => {
    // "/vietnamese" must not be read as locale "vi" + "/etnamese".
    expect(stripLocale("/vietnamese")).toEqual({
      locale: null,
      pathname: "/vietnamese",
    });
  });

  it("handles every configured locale", () => {
    for (const locale of routing.locales) {
      expect(stripLocale(`/${locale}/profile`)).toEqual({
        locale,
        pathname: "/profile",
      });
    }
  });
});
