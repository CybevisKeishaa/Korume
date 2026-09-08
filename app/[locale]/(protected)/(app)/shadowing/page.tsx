import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getPathname, redirect } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getShadowingHub } from "@/lib/data/shadowing-hub";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubShelves } from "@/components/shadowing/hub-shelves";
import { HubImportSection } from "@/components/shadowing/hub-import-section";
import { HubLibrarySection } from "@/components/shadowing/hub-library-section";
import { HubFeaturedHero } from "@/components/shadowing/hub-featured-hero";
import { HubCompanionRail } from "@/components/shadowing/hub-companion-rail";
import { HubDiscoveryControls } from "@/components/shadowing/hub-discovery-controls";
import { shadowingHubQuerySchema } from "@/lib/validation/shadowing-hub";
import enShadowing from "@/messages/en/shadowing.json";

type TaxonomyTranslationKey =
  | `situations.${keyof typeof enShadowing.situations}`
  | `sources.${keyof typeof enShadowing.sources}`;

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "videos" });
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function VideosPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const query = shadowingHubQuerySchema.safeParse({
    q: typeof searchParams?.q === "string" ? searchParams.q : undefined,
    filter: typeof searchParams?.filter === "string" ? searchParams.filter : undefined,
  });
  const hubQuery = query.success ? query.data : {};
  const [t, tCommon, tHub, result, locale] = await Promise.all([
    getTranslations("videos"),
    getTranslations("common"),
    getTranslations("shadowing"),
    getShadowingHub({ query: hubQuery.q, filter: hubQuery.filter }),
    getLocale(),
  ]);
  if (!result.ok) redirect({ href: "/login", locale });

  const hub = result.data;
  return (
    <TwoColumnShell
      railLabel={tHub("hub.railLabel")}
      rail={<HubCompanionRail rail={hub.rail} labels={{
        preparation: tHub("hub.preparation"),
        noPreparation: tHub("hub.noPreparation"),
        todayGoal: tHub("hub.todayGoal"),
        noGoal: tHub("hub.noGoal"),
        weeklyProgress: tHub("hub.weeklyProgress"),
        noWeeklyActivity: tHub("hub.noWeeklyActivity"),
        suggestion: tHub("hub.suggestion"),
        noSuggestion: tHub("hub.noSuggestion"),
        openLesson: tHub("hub.openLesson"),
        knownWordFit: (percent) => tCommon("recommendations.knownWords", { percent }),
      }} />}
      className="py-2xl"
    >
      <div className="space-y-2xl">
        <header>
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{tHub("hub.eyebrow")}</p>
          <h1 className="mt-xs text-title font-semibold text-foreground">{tHub("hub.title")}</h1>
          <p className="mt-sm text-body text-muted-foreground">{tHub("hub.subtitle")}</p>
        </header>
        <HubFeaturedHero
          lesson={hub.featured}
          isInProgress={hub.featured ? hub.continueLearning.some(({ lesson }) => lesson.id === hub.featured?.id) : false}
          labels={{
          eyebrow: tHub("hub.featured"),
          start: tHub("hub.start"),
          continue: tHub("hub.continue"),
          noThumbnail: tCommon("noThumbnail"),
          jlptLabel: tHub("hub.jlptLabel"),
          durationLabel: tHub("hub.durationLabel"),
          duration: (minutes) => tHub("hub.minutes", { count: minutes }),
          }}
        />
        <HubImportSection used={hub.quota.used} limit={hub.quota.limit} tier={hub.quota.tier} />
        <HubLibrarySection
          items={hub.library}
          labels={{
            title: t("yourVideos"),
            readyAction: tCommon("actions.next"),
            unavailable: tHub("noTranscript.title"),
            retry: tCommon("actions.retry"),
            retryPending: t("retryPending"),
            retryFailed: t("retryFailed"),
            noThumbnail: tCommon("noThumbnail"),
          }}
        />
        <HubDiscoveryControls
          filters={hub.filters.map((filter) => ({
            ...filter,
            label: tHub(`${filter.kind === "situation" ? "situations" : "sources"}.${filter.slug}` as TaxonomyTranslationKey),
          }))}
          query={hub.discovery?.query ?? ""}
          activeFilter={hub.discovery?.activeFilter ?? null}
          results={hub.discovery?.lessons ?? null}
          action={getPathname({ href: "/shadowing", locale })}
          labels={{
            searchLabel: tHub("hub.searchLabel"),
            searchPlaceholder: tHub("hub.searchPlaceholder"),
            all: tCommon("filters.all"),
            results: tHub("hub.searchResults"),
            noResults: tHub("hub.noSearchResults"),
            start: tHub("hub.start"),
            noThumbnail: tCommon("noThumbnail"),
          }}
        />
        <HubShelves
          featured={null}
          continueLearning={hub.continueLearning}
          recentlyAdded={hub.recentlyAdded}
          popular={hub.popular}
          recommendations={hub.recommendations}
          labels={{
            featured: tHub("hub.featured"),
            recentlyAdded: tHub("hub.recentlyAdded"),
            popular: tHub("hub.popular"),
            continueLearning: tHub("hub.continueLearning"),
            recommended: tCommon("recommendations.heading"),
            start: tHub("hub.start"),
            continue: tHub("hub.continue"),
            noThumbnail: tCommon("noThumbnail"),
            recommendationReason: (percent) => tCommon("recommendations.knownWords", { percent }),
          }}
        />
      </div>
    </TwoColumnShell>
  );
}
