/**
 * The localization capability's public contract (spec §0.2).
 *
 * Feature code imports from here (or `@/lib/i18n/navigation`) and nothing else.
 * `next-intl` lives below this boundary and is enforced out of feature code by
 * ESLint. Replacing the i18n library means rewriting `lib/i18n/**` — and
 * nothing else (spec §4.1).
 */
export { routing, type Locale } from "./routing";
export { NAMESPACES, type Namespace } from "./namespaces";

// The translation API features consume. Re-exported here because ESLint
// forbids feature code from importing `next-intl` (spec P1) — without this,
// Plan 3 could not call t() without either violating the boundary or
// deleting the rule that defines it.
export { useTranslations, useLocale, useFormatter } from "next-intl";
