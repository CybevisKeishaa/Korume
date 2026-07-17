import { describe, expect, it } from "vitest";
import { routing } from "@/lib/i18n/routing";
import { stripLocale } from "@/lib/i18n/locale-path";
import {
  AUTH_ROUTES,
  PROTECTED_PREFIXES,
  isAuthRoute,
  isProtectedPath,
} from "./route-protection";

describe("route protection", () => {
  // Anchor test independent of the matrix below: the matrix iterates
  // PROTECTED_PREFIXES/AUTH_ROUTES themselves, so silently *dropping* an
  // entry (e.g. deleting "/profile") makes the matrix test one row fewer
  // and all its assertions still pass. Pinning the literal contents here
  // means a removed prefix fails loudly instead of vanishing unnoticed.
  it("pins the exact set and order of PROTECTED_PREFIXES and AUTH_ROUTES", () => {
    expect(PROTECTED_PREFIXES).toEqual([
      "/dashboard",
      "/kanji",
      "/vocab",
      "/grammar",
      "/videos",
      "/reading",
      "/speaking",
      "/jlpt",
      "/jlpt-test",
      "/community",
      "/playlists",
      "/leaderboard",
      "/profile",
      "/content-manager",
      "/video-curator",
      "/admin",
    ]);
    expect(AUTH_ROUTES).toEqual(["/login", "/register"]);
  });

  it("protects a mis-cased locale prefix (defence in depth, not reliance on next-intl's redirect)", () => {
    expect(isProtectedPath(stripLocale("/VI/dashboard").pathname)).toBe(true);
    expect(isProtectedPath(stripLocale("/En/profile").pathname)).toBe(true);
  });

  it("protects every prefix under every locale", () => {
    for (const locale of routing.locales) {
      for (const prefix of PROTECTED_PREFIXES) {
        const url = `/${locale}${prefix}`;
        expect(
          isProtectedPath(stripLocale(url).pathname),
          `${url} must be protected`,
        ).toBe(true);
      }
    }
  });

  it("protects nested routes under every prefix and locale", () => {
    for (const locale of routing.locales) {
      for (const prefix of PROTECTED_PREFIXES) {
        const url = `/${locale}${prefix}/nested/deep`;
        expect(
          isProtectedPath(stripLocale(url).pathname),
          `${url} must be protected`,
        ).toBe(true);
      }
    }
  });

  it("recognises auth routes under every locale", () => {
    for (const locale of routing.locales) {
      for (const route of AUTH_ROUTES) {
        expect(isAuthRoute(stripLocale(`/${locale}${route}`).pathname)).toBe(true);
      }
    }
  });

  it("leaves public routes unprotected", () => {
    for (const locale of routing.locales) {
      expect(isProtectedPath(stripLocale(`/${locale}`).pathname)).toBe(false);
      expect(isProtectedPath(stripLocale(`/${locale}/login`).pathname)).toBe(false);
    }
  });

  it("does not protect a path that merely starts with a prefix's characters", () => {
    // "/videosomething" must not be swallowed by the "/videos" prefix.
    expect(isProtectedPath("/videosomething")).toBe(false);
  });
});
