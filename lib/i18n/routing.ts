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

/**
 * Each locale's name in its OWN language, for the Interface Language control.
 *
 * ⚠️ Deliberately NOT in either locale's `settings.json`, against the branch rule
 * that every new string lives in both catalogs. An endonym does not vary with
 * the UI language — "Tiếng Việt" is "Tiếng Việt" on an English screen — and
 * putting it in the catalogs invites a translator to render it "Vietnamese",
 * which defeats the only thing a language picker must do: let someone who
 * cannot read the current interface find their own language in it.
 *
 * Adding a locale to `routing.locales` above without adding it here is a
 * compile error, not a missing label at runtime.
 */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};
