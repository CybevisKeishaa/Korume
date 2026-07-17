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
 * @param response The response from next-intl's routing middleware. Supabase's
 * refreshed cookies are written onto it, and it is returned untouched
 * otherwise — it carries the headers that tell the app which locale resolved.
 *
 * Do not recompute the active locale from cookies or request headers. Once
 * middleware begins executing, the pathname (after `stripLocale`) is the
 * canonical routing source of truth: next-intl has already negotiated the
 * locale and encoded its decision in the URL. Re-deriving it here could
 * disagree with the URL the user is actually on, and an authorization
 * decision made against a different locale than the one being served is
 * exactly the class of bug §4.2 exists to prevent.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
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
  const activeLocale = locale ?? routing.defaultLocale;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/login`;
    // redirectTo carries the locale-stripped path; the login page redirects
    // within the active locale.
    url.searchParams.set("redirectTo", pathname);
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
