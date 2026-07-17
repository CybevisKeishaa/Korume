import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasPublicSupabaseEnv, publicEnv } from "@/lib/env";
import { stripLocale } from "@/lib/i18n/locale-path";
import { routing } from "@/lib/i18n/routing";
import { isAuthRoute, isProtectedPath } from "./route-protection";

/**
 * Refreshes the Supabase auth cookie on every request and enforces access:
 * signed-out users are bounced from protected routes to /login; signed-in
 * users are bounced from the auth pages to /dashboard.
 *
 * Runs BEFORE next-intl's middleware (see `middleware.ts`), so the request-cookie
 * mutation below lands before next-intl builds the response that is ultimately
 * returned. `NextResponse.next(init)` snapshots the forwarded
 * `x-middleware-request-*` headers once, at construction — writing cookies onto
 * an already-built response never refreshes that snapshot, and the current
 * request's Server Components would then read a stale token. Measured:
 * `.superpowers/sdd/cookie-forwarding-investigation.md`.
 *
 * Do not recompute the active locale from cookies or request headers. The
 * pathname (after `stripLocale`) is the canonical routing source of truth; an
 * authorization decision made against a different locale than the one being
 * served is exactly the class of bug §4.2 exists to prevent.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  // Before Supabase is configured, don't attempt auth — let the site run.
  if (!hasPublicSupabaseEnv()) {
    return response;
  }

  const supabase = createServerClient(
    publicEnv.supabaseUrl(),
    publicEnv.supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Rebuilt from the MUTATED request on purpose — this is what forwards
          // the refreshed cookie to Server Components. Do not "simplify" it away.
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase (do not trust
  // getSession() alone in middleware).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // CRITICAL: match on the locale-stripped path. "/vi/dashboard" does not
  // start with "/dashboard", so matching the raw pathname would report every
  // protected route as public (spec §4.2). Covered by route-protection.test.ts.
  const { locale, pathname } = stripLocale(request.nextUrl.pathname);
  // `locale` is null only for a bare ("/dashboard") or bad-prefix
  // ("/fr/dashboard") URL — next-intl would negotiate those, but it runs after
  // us and never gets the chance, because an auth redirect returns first.
  // Defaulting is deliberate: reading the locale cookie here would be exactly
  // the locale recomputation the doc comment above forbids, and a deterministic
  // locale beats a guess. The cost is that a signed-out `en` user hitting bare
  // /dashboard lands on /vi/login.
  const activeLocale = locale ?? routing.defaultLocale;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/login`;
    // redirectTo must carry the LOCALE-PREFIXED path. app/(auth)/actions.ts
    // feeds it straight to redirect(), and with localePrefix: "always" an
    // unprefixed target routes to the DEFAULT locale — dropping an `en` user
    // into `vi` after login. Building the URL here (not in actions.ts) keeps
    // locale out of feature code (spec P2). `pathname` is "" for the root after
    // stripLocale, hence the guard against a trailing slash.
    url.searchParams.set(
      "redirectTo",
      `/${activeLocale}${pathname === "/" ? "" : pathname}`,
    );
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/dashboard`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
