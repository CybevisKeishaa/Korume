import { defineRouting } from "next-intl/routing";

/**
 * The single source of truth for which locales exist and how they appear in
 * URLs (spec D2/D3). Adding a locale = adding it here + adding its catalog
 * directory. No feature code changes (spec P7).
 *
 * `localePrefix: "always"` keeps every locale symmetric — no locale is a
 * special case, so ja/zh/ko need no new thinking.
 */
export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
