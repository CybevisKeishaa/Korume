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
  const locale = routing.locales.find((l) => l === candidate);

  if (!locale) return { locale: null, pathname };

  const rest = `/${segments.slice(2).join("/")}`;
  return { locale, pathname: rest === "/" ? "/" : rest.replace(/\/$/, "") };
}
