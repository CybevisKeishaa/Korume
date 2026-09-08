import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { redirect } from "@/lib/i18n/navigation";
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
  const [t, tCommon, tHub, result] = await Promise.all([
    getTranslations("videos"),
    getTranslations("common"),
    getTranslations("shadowing"),
    getShadowingHub({ query: hubQuery.q, filter: hubQuery.filter }),
  ]);
  if (!result.ok) redirect({ href: "/login", locale: await getLocale() });

  const hub = result.data;
  const filterLabels: Record<string, string> = {
    "situation:conversation": tHub("hub.situations.conversation"),
    "situation:restaurant": tHub("hub.situations.restaurant"),
    "situation:business": tHub("hub.situations.business"),
    "situation:daily-life": tHub("hub.situations.dailyLife"),
    "situation:travel": tHub("hub.situations.travel"),
    "situation:office": tHub("hub.situations.office"),
    "situation:shopping": tHub("hub.situations.shopping"),
    "situation:cafe": tHub("hub.situations.cafe"),
    "source:youtube": tHub("hub.sources.youtube"),
    "source:nhk": tHub("hub.sources.nhk"),
    "source:podcast": tHub("hub.sources.podcast"),
    "source:drama": tHub("hub.sources.drama"),
    "source:anime": tHub("hub.sources.anime"),
    "source:vlog": tHub("hub.sources.vlog"),
    "source:news": tHub("hub.sources.news"),
  };
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
        streak: tHub("hub.streak"),
        reviewsDue: (count) => tHub("hub.reviewsDue", { count }),
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
          filters={hub.filters.flatMap((filter) => {
            const label = filterLabels[`${filter.kind}:${filter.slug}`];
            return label ? [{ ...filter, label }] : [];
          })}
          query={hub.discovery?.query ?? ""}
          activeFilter={hub.discovery?.activeFilter ?? null}
          results={hub.discovery?.lessons ?? null}
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
