/**
 * The localization capability's public contract (spec §0.2).
 *
 * Feature code imports from here (or `@/lib/i18n/navigation`) and nothing else.
 * `next-intl` lives below this boundary and must not be imported directly by
 * feature code. Replacing the i18n library means rewriting `lib/i18n/**` — and
 * nothing else (spec §4.1).
 */
export { routing, type Locale } from "./routing";
export { NAMESPACES, type Namespace } from "./namespaces";

// The translation API features consume. Re-exported here because feature
// code must import only from this barrel, not from `next-intl` directly
// (spec P1) — without this, feature code could not call t() without violating
// the boundary.
export { useTranslations, useLocale, useFormatter } from "next-intl";
