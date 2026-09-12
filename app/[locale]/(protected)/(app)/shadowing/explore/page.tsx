import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getPathname, redirect } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getShadowingExplore } from "@/lib/data/shadowing-explore";
import { shadowingExploreQuerySchema } from "@/lib/validation/shadowing-explore";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubLessonCard } from "@/components/shadowing/hub-lesson-card";
import { HubLibrarySection } from "@/components/shadowing/hub-library-section";
import { HubSectionHeading } from "@/components/shadowing/hub-section-heading";
import { ExploreShelves } from "@/components/shadowing/explore-shelves";
import enShadowing from "@/messages/en/shadowing.json";

type SituationTranslationKey = `situations.${keyof typeof enShadowing.situations}`;

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "shadowing" });
  return { title: t("explore.title") };
}

export const dynamic = "force-dynamic";

function exploreHref(pathname: string, query: { q?: string; situation?: string }): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.situation) params.set("situation", query.situation);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export default async function ExplorePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const parsed = shadowingExploreQuerySchema.safeParse({
    q: typeof searchParams?.q === "string" ? searchParams.q : undefined,
    situation: typeof searchParams?.situation === "string" ? searchParams.situation : undefined,
  });
  const query = parsed.success ? parsed.data : {};
  const [t, tHub, tShadowing, tCommon, tVideos, result, locale] = await Promise.all([
    getTranslations("shadowing.explore"),
    getTranslations("shadowing.hub"),
    getTranslations("shadowing"),
    getTranslations("common"),
    getTranslations("videos"),
    getShadowingExplore(query),
    getLocale(),
  ]);
  if (!result.ok) redirect({ href: "/login", locale });

  const data = result.data;
  const path = getPathname({ href: "/shadowing/explore", locale });
  const hubPath = getPathname({ href: "/shadowing", locale });
  const recentCards = data.recentlyAdded.map((lesson) => (
    <HubLessonCard key={lesson.id} lesson={lesson} href={`/shadowing/${lesson.id}`} actionLabel={tHub("actions.start")} noThumbnailLabel={tCommon("noThumbnail")} />
  ));
  const recommendationCards = data.recommendations.map((recommendation) => (
    <HubLessonCard
      key={recommendation.videoId}
      lesson={{
        id: recommendation.videoId,
        youtubeVideoId: recommendation.youtubeVideoId,
        title: recommendation.title,
        durationSeconds: null,
        thumbnailUrl: recommendation.thumbnailUrl,
        jlptLevelEstimate: recommendation.jlptLevelEstimate,
      }}
      href={`/shadowing/${recommendation.videoId}`}
      actionLabel={tHub("actions.start")}
      noThumbnailLabel={tCommon("noThumbnail")}
      detail={recommendation.reason?.kind === "known-word-fit" ? tCommon("recommendations.knownWords", { percent: Math.round(recommendation.reason.knownRatio * 100) }) : undefined}
    />
  ));

  return (
    <TwoColumnShell railLabel="" className="py-2xl">
      <div className="space-y-2xl">
        <header>
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{t("eyebrow")}</p>
          <h1 className="mt-xs text-title font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-sm text-body text-muted-foreground">{t("subtitle")}</p>
          <form action={path} className="mt-xl" role="search" aria-label={tHub("sections.search")}>
            {query.situation ? <input type="hidden" name="situation" value={query.situation} /> : null}
            <label className="sr-only" htmlFor="explore-search">{tHub("sections.search")}</label>
            <div className="flex gap-sm">
              <input id="explore-search" name="q" defaultValue={query.q} placeholder={tHub("search.placeholder")} className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-md text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <button type="submit" className="rounded-md bg-primary px-md text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{tHub("sections.search")}</button>
            </div>
          </form>
        </header>

        <HubLibrarySection
          items={data.library}
          emptyActionHref={`${hubPath}#hub-import`}
          labels={{
            title: t("imported"),
            readyAction: tHub("actions.openLesson"),
            unavailable: tShadowing("noTranscript.title"),
            retry: tCommon("actions.retry"),
            retryPending: tVideos("retryPending"),
            retryFailed: tVideos("retryFailed"),
            noThumbnail: tCommon("noThumbnail"),
            emptyTitle: tHub("empty.library.title"),
            emptyBody: tHub("empty.library.body"),
            emptyAction: tHub("empty.library.action"),
          }}
        />

        <section aria-label={t("recent")}>
          <HubSectionHeading title={t("recent")} />
          {recentCards.length ? <ul className="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">{recentCards}</ul> : <p className="mt-md text-sm text-muted-foreground">{t("empty")}</p>}
        </section>

        <section aria-label={t("recommended")}>
          <HubSectionHeading title={t("recommended")} />
          {recommendationCards.length ? <ul className="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">{recommendationCards}</ul> : <p className="mt-md text-sm text-muted-foreground">{t("empty")}</p>}
        </section>

        <section aria-label={t("situations")}>
          <HubSectionHeading title={t("situations")} />
          <div className="mt-md flex flex-wrap gap-xs">
            <a href={exploreHref(path, { q: query.q })} aria-current={data.activeSituation === null ? "page" : undefined} className="rounded-full border border-border px-sm py-xs text-sm font-medium text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("all")}</a>
            {data.situations.map((situation) => (
              <a key={situation.id} href={exploreHref(path, { q: query.q, situation: situation.slug })} aria-current={data.activeSituation === situation.slug ? "page" : undefined} className="rounded-full border border-border px-sm py-xs text-sm font-medium text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {tShadowing(`situations.${situation.slug}` as SituationTranslationKey)}
              </a>
            ))}
          </div>
        </section>

        {data.quietSuggestion?.reason?.kind === "known-word-fit" ? (
          <section aria-label={tCommon("recommendations.heading")} className="rounded-xl border border-border bg-card p-md-lg">
            <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{tCommon("recommendations.heading")}</p>
            <p className="mt-xs text-body font-semibold text-foreground">{data.quietSuggestion.title}</p>
            <p className="mt-xs text-sm text-muted-foreground">{tCommon("recommendations.knownWords", { percent: Math.round(data.quietSuggestion.reason.knownRatio * 100) })}</p>
          </section>
        ) : null}

        <ExploreShelves shelves={data.shelves} labels={{
          start: tHub("actions.start"),
          preview: t("preview"),
          noThumbnail: tCommon("noThumbnail"),
          empty: t("empty"),
          moreAvailable: t("moreAvailable"),
          drawer: {
            close: t("drawer.close"),
            start: t("drawer.start"),
            add: t("drawer.add"),
            added: t("drawer.added"),
            adding: t("drawer.adding"),
            addFailed: t("drawer.addFailed"),
            transcript: t("drawer.transcript"),
            transcriptUnavailable: t("drawer.transcriptUnavailable"),
            durationTemplate: tHub("metadata.minutes", { count: "{count}" }),
            metadata: { jlpt: t("drawer.jlpt"), duration: t("drawer.duration"), vocabulary: t("drawer.vocabulary"), sentences: t("drawer.sentences") },
          },
        }} />
      </div>
    </TwoColumnShell>
  );
}
