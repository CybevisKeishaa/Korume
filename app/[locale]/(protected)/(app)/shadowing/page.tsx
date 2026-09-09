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
        preparation: tHub("hub.rail.preparation"),
        noPreparation: tHub("hub.rail.noPreparation"),
        todayGoal: tHub("hub.rail.todayGoal"),
        noGoal: tHub("hub.rail.noGoal"),
        weeklyProgress: tHub("hub.rail.weeklyProgress"),
        noWeeklyActivity: tHub("hub.rail.noWeeklyActivity"),
        suggestion: tHub("hub.rail.suggestion"),
        noSuggestion: tHub("hub.rail.noSuggestion"),
        openLesson: tHub("hub.actions.openLesson"),
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
          eyebrow: tHub("hub.sections.featured"),
          start: tHub("hub.actions.start"),
          continue: tHub("hub.actions.continue"),
          noThumbnail: tCommon("noThumbnail"),
          jlptLabel: tHub("hub.metadata.jlptLabel"),
          durationLabel: tHub("hub.metadata.durationLabel"),
          duration: (minutes) => tHub("hub.metadata.minutes", { count: minutes }),
          emptyTitle: tHub("hub.empty.featured.title"),
          emptyBody: tHub("hub.empty.featured.body"),
          }}
        />
        <HubImportSection
          used={hub.quota.used}
          limit={hub.quota.limit}
          tier={hub.quota.tier}
          labels={{
            title: tHub("hub.import.title"),
            quotaUnlimited: tHub("hub.import.quotaUnlimited"),
            quotaUsed: (used, limit) => tHub("hub.import.quotaUsed", { used, limit }),
          }}
        />
        <HubLibrarySection
          items={hub.library}
          labels={{
            title: tHub("hub.sections.library"),
            readyAction: tCommon("actions.next"),
            unavailable: tHub("noTranscript.title"),
            retry: tCommon("actions.retry"),
            retryPending: t("retryPending"),
            retryFailed: t("retryFailed"),
            noThumbnail: tCommon("noThumbnail"),
            emptyTitle: tHub("hub.empty.library.title"),
            emptyBody: tHub("hub.empty.library.body"),
            emptyAction: tHub("hub.empty.library.action"),
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
            searchLabel: tHub("hub.sections.search"),
            searchPlaceholder: tHub("hub.search.placeholder"),
            all: tCommon("filters.all"),
            results: tHub("hub.search.results"),
            noResults: tHub("hub.search.noResults"),
            start: tHub("hub.actions.start"),
            noThumbnail: tCommon("noThumbnail"),
          }}
        />
        <HubShelves
          continueLearning={hub.continueLearning}
          recentlyAdded={hub.recentlyAdded}
          popular={hub.popular}
          recommendations={hub.recommendations}
          labels={{
            recentlyAdded: tHub("hub.sections.recentlyAdded"),
            popular: tHub("hub.sections.popular"),
            continueLearning: tHub("hub.sections.continueLearning"),
            recommended: tHub("hub.sections.recommended"),
            start: tHub("hub.actions.start"),
            continue: tHub("hub.actions.continue"),
            noThumbnail: tCommon("noThumbnail"),
            recommendationReason: (percent) => tCommon("recommendations.knownWords", { percent }),
            empty: {
              popular: { title: tHub("hub.empty.popular.title"), body: tHub("hub.empty.popular.body") },
              continueLearning: { title: tHub("hub.empty.continueLearning.title"), body: tHub("hub.empty.continueLearning.body") },
              recentlyAdded: { title: tHub("hub.empty.recentlyAdded.title"), body: tHub("hub.empty.recentlyAdded.body") },
              recommended: { title: tHub("hub.empty.recommended.title"), body: tHub("hub.empty.recommended.body") },
            },
          }}
        />
      </div>
    </TwoColumnShell>
  );
}
