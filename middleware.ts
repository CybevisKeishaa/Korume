import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Supabase FIRST. It mutates request.cookies when it refreshes the session,
  // and next-intl's response must be built from the mutated request — a
  // response built earlier bakes in the stale cookie and the current request's
  // Server Components read an expired token. Measured, not assumed:
  // .superpowers/sdd/cookie-forwarding-investigation.md
  const authResponse = await updateSession(request);

  // A redirect from updateSession is an auth decision (signed-out on a
  // protected route, or signed-in on an auth page). It is already
  // locale-preserving, so intl has nothing to add.
  if (authResponse.status >= 300 && authResponse.status < 400) {
    return authResponse;
  }

  const intlResponse = handleI18nRouting(request);

  // Carry Supabase's refreshed Set-Cookie onto whatever intl decided to return.
  // Only the browser-facing cookies need copying: intl built its own forwarded
  // request headers from the already-mutated request above.
  authResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  return intlResponse;
}

export const config = {
  // Run on all paths except Next internals, API routes, the auth route
  // handlers and static assets.
  //
  // `api` and `auth` are excluded because neither is localized. Letting the
  // intl middleware redirect /api/srs/review to /vi/api/srs/review would break
  // every client fetch; likewise /auth/callback (the OAuth + email-confirmation
  // handler in app/auth/) would 307 to /vi/auth/callback, which does not exist —
  // silently breaking every OAuth sign-in. Both keep authenticating server-side
  // via their own requireUser()/createClient(), so losing updateSession here is
  // safe.
  //
  // Localizing either of these must be a deliberate opt-in: expanding the
  // matcher changes every client fetch URL and every OAuth redirect URI
  // registered with the provider. That is an architectural change, not a
  // refactor.
  matcher: [
    "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
