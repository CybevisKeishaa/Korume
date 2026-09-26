import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getPathname } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getHubDiscovery } from "@/lib/data/shadowing-hub";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubDiscoveryControls } from "@/components/shadowing/hub-discovery-controls";
import { shadowingHubQuerySchema } from "@/lib/validation/shadowing-hub";
import enShadowing from "@/messages/en/shadowing.json";

type TaxonomyTranslationKey =
  | `situations.${keyof typeof enShadowing.situations}`
  | `sources.${keyof typeof enShadowing.sources}`;

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "pronunciation" });
  return { title: t("hub.title") };
}

export const dynamic = "force-dynamic";

export default async function PronunciationPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const query = shadowingHubQuerySchema.safeParse({
    q: typeof searchParams?.q === "string" ? searchParams.q : undefined,
    filter: typeof searchParams?.filter === "string" ? searchParams.filter : undefined,
  });
  const hubQuery = query.success ? query.data : {};
  const [t, tCommon, tHub, hub, locale] = await Promise.all([
    getTranslations("pronunciation"),
    getTranslations("common"),
    getTranslations("shadowing"),
    getHubDiscovery({ query: hubQuery.q, filter: hubQuery.filter }),
    getLocale(),
  ]);

  return (
    <TwoColumnShell railLabel={t("hub.searchLabel")} className="py-2xl">
      <HubDiscoveryControls
        filters={hub.filters.map((filter) => ({
          ...filter,
          label: tHub(`${filter.kind === "situation" ? "situations" : "sources"}.${filter.slug}` as TaxonomyTranslationKey),
        }))}
        query={hub.discovery?.query ?? ""}
        activeFilter={hub.discovery?.activeFilter ?? null}
        results={hub.discovery?.lessons ?? null}
        action={getPathname({ href: "/pronunciation", locale })}
        basePath="/pronunciation"
        heading={(
          <header>
            <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{t("hub.eyebrow")}</p>
            <h1 className="mt-xs text-title font-semibold text-foreground">{t("hub.title")}</h1>
            <p className="mt-sm text-body text-muted-foreground">{t("hub.subtitle")}</p>
          </header>
        )}
        filterToggleLabel={t("hub.filterToggleLabel")}
        labels={{
          searchLabel: t("hub.searchLabel"),
          searchPlaceholder: t("hub.searchPlaceholder"),
          all: tCommon("filters.all"),
          results: tHub("hub.search.results"),
          noResults: tHub("hub.search.noResults"),
          start: tHub("hub.actions.start"),
          noThumbnail: tCommon("noThumbnail"),
        }}
      />
    </TwoColumnShell>
  );
}
