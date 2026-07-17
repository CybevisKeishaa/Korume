import { routing, type Locale } from "./routing";

/**
 * Splits a locale prefix off a pathname.
 *
 * Route protection MUST run against the stripped pathname: with
 * `localePrefix: "always"` every URL carries a prefix, and matching
 * "/vi/dashboard" against "/dashboard" silently yields "not protected" —
 * i.e. an auth bypass (spec §4.2, P3).
 */
export function stripLocale(pathname: string): {
  locale: Locale | null;
  pathname: string;
} {
  const segments = pathname.split("/");
  // "/vi/dashboard".split("/") === ["", "vi", "dashboard"]
  const candidate = segments[1];
  // next-intl matches the locale prefix case-insensitively and 307-redirects
  // a mis-cased request (e.g. "/VI/dashboard") to the canonical lowercase
  // form before it is served. This module must not depend on that redirect
  // happening first: match case-insensitively here too, and always return
  // the canonical locale from `routing.locales`, so a mis-cased path that
  // somehow reaches this predicate resolves to "protected", never "public".
  const locale = routing.locales.find(
    (l) => candidate !== undefined && l.toLowerCase() === candidate.toLowerCase(),
  );

  if (!locale) return { locale: null, pathname: collapseSlashes(pathname) };

  const rest = `/${segments.slice(2).join("/")}`;
  return { locale, pathname: collapseSlashes(rest) };
}

/** Collapses repeated slashes ("//" or more) into one and drops a trailing slash. */
function collapseSlashes(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  return collapsed === "/" ? "/" : collapsed.replace(/\/$/, "");
}
