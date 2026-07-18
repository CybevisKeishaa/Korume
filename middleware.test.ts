// @vitest-environment node
//
// Node, not the suite-wide jsdom: NextRequest/NextResponse are built on undici's
// Request/Headers, and Next asserts `headers instanceof Headers`. jsdom installs
// its own Headers global, so a NextRequest built under jsdom fails that check
// inside NextResponse.next(). Same precedent as lib/supabase/middleware.test.ts.
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards the top-level middleware COMPOSITION (Supabase first → next-intl →
 * cookie copy), not updateSession's own logic (covered by
 * lib/supabase/middleware.test.ts). This ordering fixed a measured
 * stale-auth-cookie bug (.superpowers/sdd/cookie-forwarding-investigation.md);
 * these tests are what keep a future refactor from silently reopening it.
 *
 * updateSession is mocked; next-intl's middleware runs for real, so the
 * assertions cover what intl actually returns (rewrite for a prefixed URL,
 * 307 for a bare one), not a stub of it.
 */
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

const supabaseMiddleware = await import("@/lib/supabase/middleware");
const updateSession = vi.mocked(supabaseMiddleware.updateSession);
const { middleware } = await import("./middleware");

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

/** updateSession outcome: pass-through response carrying a refreshed cookie. */
function passThroughWithCookie(req: NextRequest): NextResponse {
  const response = NextResponse.next({ request: req });
  response.cookies.set("sb-test-auth-token", "refreshed", { path: "/" });
  return response;
}

describe("middleware composition (Supabase → intl → cookie copy)", () => {
  beforeEach(() => {
    updateSession.mockReset();
  });

  it("returns updateSession's auth redirect untouched — intl never runs over it", async () => {
    // Bare /dashboard: if the auth short-circuit were broken, intl would win
    // and the final Location would be its own redirect (/vi/dashboard). So
    // asserting /vi/login proves the 3xx returned BEFORE intl, behaviourally.
    updateSession.mockImplementation(async (req) =>
      NextResponse.redirect(
        new URL("/vi/login?redirectTo=%2Fvi%2Fdashboard", req.url),
      ),
    );

    const response = await middleware(request("/dashboard"));

    expect(updateSession).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") as string);
    expect(location.pathname).toBe("/vi/login");
    expect(location.searchParams.get("redirectTo")).toBe("/vi/dashboard");
  });

  it("carries Supabase's refreshed Set-Cookie onto intl's pass-through response", async () => {
    updateSession.mockImplementation(async (req) => passThroughWithCookie(req));

    // Prefixed URL: intl rewrites internally and returns a 200.
    const response = await middleware(request("/en/kanji"));

    expect(response.status).toBe(200);
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
  });

  it("carries the refreshed cookie even when intl redirects a bare URL", async () => {
    updateSession.mockImplementation(async (req) => passThroughWithCookie(req));

    // Bare URL, no Accept-Language, no NEXT_LOCALE cookie → intl 307s to the
    // default locale. The refreshed session cookie must ride along, or the
    // token refresh is lost on every prefix redirect.
    const response = await middleware(request("/kanji"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") as string);
    expect(location.pathname).toBe("/vi/kanji");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
  });
});
