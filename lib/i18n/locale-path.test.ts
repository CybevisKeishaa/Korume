import { describe, expect, it } from "vitest";
import { stripLocale } from "./locale-path";
import { routing } from "./routing";

describe("stripLocale", () => {
  it("strips a known locale prefix", () => {
    expect(stripLocale("/vi/dashboard")).toEqual({
      locale: "vi",
      pathname: "/dashboard",
    });
    expect(stripLocale("/en/shadowing/abc")).toEqual({
      locale: "en",
      pathname: "/shadowing/abc",
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

  it("matches a mis-cased locale prefix and returns the canonical lowercase locale", () => {
    // next-intl matches locale prefixes case-insensitively and 307-redirects
    // "/VI/..." to "/vi/...". This module must not rely on that redirect:
    // a mis-cased path reaching this predicate must still resolve to its
    // canonical locale, not fall through to "unprefixed" (locale: null).
    expect(stripLocale("/VI/dashboard")).toEqual({
      locale: "vi",
      pathname: "/dashboard",
    });
    expect(stripLocale("/En/profile")).toEqual({
      locale: "en",
      pathname: "/profile",
    });
  });

  it("collapses repeated slashes in the stripped pathname", () => {
    expect(stripLocale("/vi//dashboard")).toEqual({
      locale: "vi",
      pathname: "/dashboard",
    });
    expect(stripLocale("/vi/dashboard//")).toEqual({
      locale: "vi",
      pathname: "/dashboard",
    });
  });

  it("collapses repeated slashes even without a locale prefix", () => {
    expect(stripLocale("//dashboard")).toEqual({
      locale: null,
      pathname: "/dashboard",
    });
  });
});
