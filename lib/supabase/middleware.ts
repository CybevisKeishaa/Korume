import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasPublicSupabaseEnv, publicEnv } from "@/lib/env";

/** Route prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = [
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
  // Layer 7 admin CMS (`app/(admin)/admin/**`). Middleware only ensures the
  // request is signed IN — it has no cheap way to check `users.is_admin`
  // here (that requires a service-role DB read; see `lib/admin/guard.ts`),
  // so a signed-in non-admin still reaches the route and is bounced to
  // `/dashboard` by `app/(admin)/admin/layout.tsx`'s own server-side
  // `isAdmin()` check. Treat this entry as "auth required", not "admin
  // required" — the two checks are deliberately split across two layers.
  "/admin",
];

const AUTH_ROUTES = ["/login", "/register"];

/**
 * Refreshes the Supabase auth cookie on every request and enforces access:
 * signed-out users are bounced from protected routes to /login; signed-in
 * users are bounced from the auth pages to /dashboard.
 */
export async function updateSession(request: NextRequest) {
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

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
