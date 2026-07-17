import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "./routing";
import { NAMESPACES } from "./namespaces";

/**
 * Merges the per-namespace catalogs into the single message object next-intl
 * expects. Catalogs are split per feature for ownership (spec P4) and to keep
 * files small (CLAUDE.md §6) — the merge is an implementation detail of the
 * foundation; features never see it.
 */
async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(
      async (namespace) =>
        [
          namespace,
          (await import(`../../messages/${locale}/${namespace}.json`)).default,
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return { locale, messages: await loadMessages(locale) };
});
