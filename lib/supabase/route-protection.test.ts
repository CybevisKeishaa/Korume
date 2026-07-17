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
