/** Route prefixes that require an authenticated session. Locale-stripped paths. */
export const PROTECTED_PREFIXES = [
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
  // Layer 7 admin CMS (`app/[locale]/(admin)/admin/**`). Middleware only ensures
  // the request is signed IN — it has no cheap way to check `users.is_admin`
  // here (that requires a service-role DB read; see `lib/admin/guard.ts`), so a
  // signed-in non-admin still reaches the route and is bounced to `/dashboard`
  // by the admin layout's own server-side check. Treat this entry as "auth
  // required", not "admin required" — the two checks are deliberately split
  // across two layers.
  "/admin",
] as const;

export const AUTH_ROUTES = ["/login", "/register"] as const;

/**
 * @param pathname MUST already be locale-stripped (see `stripLocale`).
 * Passing a prefixed pathname here returns false for protected routes —
 * that is the auth bypass this module exists to prevent (spec §4.2).
 */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** @param pathname MUST already be locale-stripped. */
export function isAuthRoute(pathname: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(pathname);
}
