// @vitest-environment node
//
// Node, not the suite-wide jsdom: NextRequest/NextResponse are built on undici's
// Request/Headers, and Next asserts `headers instanceof Headers`. jsdom installs
// its own Headers global, so a NextRequest built under jsdom fails that check
// inside NextResponse.next() with "request.headers must be an instance of
// Headers". Middleware never runs in a browser anyway.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routing } from "@/lib/i18n/routing";

/**
 * Asserts the ASSEMBLED redirect URL that `updateSession` builds, rather than
 * the pieces the pure layer owns (`stripLocale` + `isProtectedPath` are covered
 * by route-protection.test.ts). The plan offered a weaker piece-wise test as a
 * fallback; the composed function is testable with a single mock — the Supabase
 * client — so this asserts the thing that actually breaks: the exact URL a
 * signed-out user is bounced to, and the `redirectTo` they come back with.
 */

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

// Imported after the mock is registered (vi.mock is hoisted, but the module
// graph must still be loaded lazily to pick up the env set in beforeEach).
const { updateSession } = await import("./middleware");

describe("updateSession locale-preserving redirects", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "stub-anon-key";
    getUser.mockReset();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  const signedOut = () => getUser.mockResolvedValue({ data: { user: null } });
  const signedIn = () =>
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });

  it("keeps the user in their locale across the login round trip", async () => {
    signedOut();
    for (const locale of routing.locales) {
      const response = await updateSession(
        new NextRequest(`http://localhost:3000/${locale}/dashboard`),
      );

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location") as string);
      // The bounce stays in the locale the user was browsing...
      expect(location.pathname).toBe(`/${locale}/login`);
      // ...and so does where they land after logging in. An unprefixed
      // redirectTo would route to the DEFAULT locale, silently throwing an
      // `en` user into `vi`.
      expect(location.searchParams.get("redirectTo")).toBe(
        `/${locale}/dashboard`,
      );
    }
  });

  it("preserves nested protected paths in redirectTo", async () => {
    signedOut();
    const response = await updateSession(
      new NextRequest("http://localhost:3000/en/vocab/review"),
    );
    const location = new URL(response.headers.get("location") as string);
    expect(location.pathname).toBe("/en/login");
    expect(location.searchParams.get("redirectTo")).toBe("/en/vocab/review");
  });

  it("falls back to the default locale for a bare protected path", async () => {
    signedOut();
    const response = await updateSession(
      new NextRequest("http://localhost:3000/dashboard"),
    );
    const location = new URL(response.headers.get("location") as string);
    expect(location.pathname).toBe(`/${routing.defaultLocale}/login`);
    expect(location.searchParams.get("redirectTo")).toBe(
      `/${routing.defaultLocale}/dashboard`,
    );
  });

  it("builds a redirectTo that survives safeRedirectPath", async () => {
    // The value is consumed by app/(auth)/actions.ts via safeRedirectPath.
    // A prefixed path must still validate as a safe internal path, or login
    // silently falls back to /dashboard and loses the locale anyway.
    const { safeRedirectPath } = await import("@/lib/safe-redirect");
    signedOut();
    for (const locale of routing.locales) {
      const response = await updateSession(
        new NextRequest(`http://localhost:3000/${locale}/dashboard`),
      );
      const redirectTo = new URL(
        response.headers.get("location") as string,
      ).searchParams.get("redirectTo");
      expect(safeRedirectPath(redirectTo)).toBe(`/${locale}/dashboard`);
    }
  });

  it("sends a signed-in user off the auth pages into their own locale", async () => {
    signedIn();
    for (const locale of routing.locales) {
      const response = await updateSession(
        new NextRequest(`http://localhost:3000/${locale}/login`),
      );
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location") as string);
      expect(location.pathname).toBe(`/${locale}/dashboard`);
    }
  });

  it("does not redirect a signed-out user on a public route", async () => {
    signedOut();
    const response = await updateSession(
      new NextRequest("http://localhost:3000/en"),
    );
    expect(response.status).toBe(200);
  });
});
