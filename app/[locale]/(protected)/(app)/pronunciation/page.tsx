import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getPathname } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getHubDiscovery, toHubLesson } from "@/lib/data/shadowing-hub";
import { getLearningPaths, getPracticeGoals, getShadowingCollections, recommendedPracticeGoalId } from "@/lib/data/collections";
import { getJlptSpeakingSummary, getWeeklyPronunciationMetrics } from "@/lib/data/pronunciation-metrics";
import { JLPT_LEVELS } from "@/lib/conversation-types";
import { listPracticeSituations } from "@/lib/data/lesson-taxonomy";
import { formatCourseDuration, formatHours, formatLevelBand } from "@/lib/format-course-duration";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubDiscoveryControls } from "@/components/shadowing/hub-discovery-controls";
import { HubFeaturedHero } from "@/components/shadowing/hub-featured-hero";
import { HubContinueStrip } from "@/components/shadowing/hub-continue-strip";
import { HubPathShelf } from "@/components/shadowing/hub-path-shelf";
import { HubShelf } from "@/components/shadowing/hub-shelf";
import { HubCollectionCard, HubLevelCard, HubSituationTile } from "@/components/shadowing/hub-practice-cards";
import { courseProgressPercent } from "@/components/shadowing/hub-course-progress";
import { HubPathCard } from "@/components/shadowing/hub-path-card";
import { pathCardLabels, pathCards, goalCards } from "./path-card-copy";
import { pronunciationDisplaySchema, shadowingHubQuerySchema } from "@/lib/validation/shadowing-hub";
import { getMyPreferences } from "@/lib/data/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { HubDisplayPanel } from "@/components/shadowing/hub-display-panel";
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
  const param = (key: string) => typeof searchParams?.[key] === "string" ? searchParams[key] as string : undefined;
  const query = shadowingHubQuerySchema.safeParse({ q: param("q"), filter: param("filter") });
  const hubQuery = query.success ? query.data : {};
  // Parsed on their own: every display field falls back alone, never fails.
  const urlDisplay = pronunciationDisplaySchema.parse({ sort: param("sort"), duration: param("duration"), hideCompleted: param("hideCompleted") });
  // The URL wins when it sets any display value; otherwise the saved profile applies.
  const urlControlsDisplay = ["sort", "duration", "hideCompleted"].some((key) => typeof searchParams?.[key] === "string");
  const displayPromise = urlControlsDisplay
    ? Promise.resolve(urlDisplay)
    : getMyPreferences().then((preferences) => ({
      sort: preferences?.pronunciationSort ?? DEFAULT_PREFERENCES.pronunciationSort,
      duration: preferences?.pronunciationDuration ?? DEFAULT_PREFERENCES.pronunciationDuration,
      hideCompleted: preferences?.pronunciationHideCompleted ?? DEFAULT_PREFERENCES.pronunciationHideCompleted,
    }));
  const [t, tCommon, tHub, hub, display, learning, locale, situations, goals, weeklyMetrics, shadowingCollections, jlptLevels] = await Promise.all([
    getTranslations("pronunciation"),
    getTranslations("common"),
    getTranslations("shadowing"),
    displayPromise.then((value) => getHubDiscovery({ query: hubQuery.q, filter: hubQuery.filter, ...value })),
    displayPromise,
    getLearningPaths(),
    getLocale(),
    listPracticeSituations(),
    getPracticeGoals(),
    getWeeklyPronunciationMetrics(),
    getShadowingCollections(),
    getJlptSpeakingSummary(),
  ]);
  const course = learning.featured;
  const recommendedGoalId = recommendedPracticeGoalId(goals, weeklyMetrics.weakest);
  const duration = (minutes: number) => formatCourseDuration(minutes, {
    minutes: (value) => t("hub.durationMinutes", { minutes: value }),
    hours: (value) => t("hub.durationHours", { hours: value, hoursText: formatHours(value, locale) }),
  });
  const levelBand = formatLevelBand(course?.levelBand ?? null, {
    band: (value) => t(`hub.levels.${value}`),
    range: (from, to) => t("hub.levelRange", { from, to }),
  });
  const cards = pathCardLabels(t);

  return (
    <TwoColumnShell railLabel={t("hub.searchLabel")} className="py-2xl">
      <HubDiscoveryControls
        // The studio adds the JLPT levels to the Hub's taxonomy chips; a level's label is its code.
        filters={[...hub.filters, ...JLPT_LEVELS.map((level) => ({ kind: "level" as const, slug: level.toLowerCase() }))].map((filter) => ({
          ...filter,
          label: filter.kind === "level"
            ? filter.slug.toUpperCase()
            : tHub(`${filter.kind === "situation" ? "situations" : "sources"}.${filter.slug}` as TaxonomyTranslationKey),
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
        toolbar={(
          <HubDisplayPanel
            value={display}
            labels={{
              trigger: t("hub.display.trigger"), title: t("hub.display.title"), sort: t("hub.display.sort"),
              recommended: t("hub.display.recommended"), newest: t("hub.display.newest"), shortest: t("hub.display.shortest"), inProgress: t("hub.display.inProgress"),
              duration: t("hub.display.duration"), anyDuration: t("hub.display.anyDuration"), underTen: t("hub.display.underTen"), tenToThirty: t("hub.display.tenToThirty"), overThirty: t("hub.display.overThirty"),
              hideCompleted: t("hub.display.hideCompleted"), apply: t("hub.display.apply"), reset: t("hub.display.reset"), close: t("hub.display.close"), saveFailed: t("hub.display.saveFailed"),
            }}
          />
        )}
        beforeResults={(
          <>
            <HubFeaturedHero
              course={course ? {
                title: course.collection.title,
                description: course.collection.description,
                total: course.total,
                completed: course.completed,
                lessonCount: course.lessonCount,
                durationMinutes: course.durationMinutes,
                jlptRange: course.jlptRange,
                levelBand,
                coverUrl: course.coverUrl,
                previewHref: `/pronunciation/collections/${course.collection.slug}`,
                next: course.next ? toHubLesson(course.next) : null,
                selectedByRecentActivity: course.selectedByRecentActivity,
              } : null}
              labels={{
                eyebrow: t("hub.featuredCourse"),
                start: t("hub.startCourse"),
                continue: t("hub.continueLearning"),
                preview: t("hub.previewCourse"),
                lessonsLabel: t("hub.lessonsLabel"),
                lessons: (count) => t("hub.lessons", { count }),
                levelLabel: t("hub.level"),
                durationLabel: t("hub.duration"),
                duration,
                jlptLabel: t("hub.jlpt"),
                complete: (percent) => t("hub.complete", { percent }),
                progressLessons: (completed, total) => t("hub.courseProgress", { completed, total }),
                emptyTitle: t("hub.emptyCourse.title"),
                emptyBody: t("hub.emptyCourse.body"),
              }}
            />
            {course?.resume ? (
              <HubContinueStrip
                course={course.collection.title}
                lesson={course.resume.lesson}
                index={course.resume.index}
                percent={course.resume.percent}
                labels={{
                  eyebrow: t("hub.continueWhereLeftOff"),
                  lesson: (index) => t("hub.lessonNumber", { number: index }),
                  percent: (percent) => t("hub.percent", { percent }),
                }}
              />
            ) : null}
          </>
        )}
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
      <div className="mt-3xl">
        <HubPathShelf
          title={t("hub.paths.title")}
          // The frame shelves four; "View all" holds the rest.
          paths={pathCards(learning.paths.slice(0, 4), t)}
          labels={cards}
          viewAll={{ href: "/pronunciation/paths", label: t("hub.paths.viewAll") }}
          empty={{ title: t("hub.paths.emptyTitle"), body: t("hub.paths.emptyBody") }}
        />
      </div>
      <div className="mt-3xl">
        {/* Every situation with a lesson fits the frame's four-by-two grid, so there is no "View all". */}
        <HubShelf title={t("hub.situations.title")} empty={{ title: t("hub.situations.emptyTitle"), body: t("hub.situations.emptyBody") }}>
          {situations.map((situation) => {
            const label = tHub(`situations.${situation.slug}` as TaxonomyTranslationKey);
            return (
              <HubSituationTile
                key={situation.slug}
                label={label}
                icon={situation.icon}
                href={`/pronunciation?filter=${encodeURIComponent(`situation:${situation.slug}`)}`}
                action={t("hub.situations.start")}
                actionLabel={t("hub.situations.startLabel", { situation: label })}
              />
            );
          })}
        </HubShelf>
      </div>
      <div className="mt-3xl">
        <HubShelf columns={3} title={t("hub.goals.title")} empty={{ title: t("hub.goals.emptyTitle"), body: t("hub.goals.emptyBody") }}>
          {goalCards(goals, t, recommendedGoalId).map((goal) => (
            <HubPathCard key={goal.id} path={goal} labels={cards} />
          ))}
        </HubShelf>
      </div>
      <div className="mt-3xl">
        {/* Every level fits the frame's five-up row, so there is no "View all". */}
        <HubShelf columns={5} title={t("hub.jlptSpeaking.title")} empty={{ title: t("hub.jlptSpeaking.emptyTitle"), body: t("hub.jlptSpeaking.emptyBody") }}>
          {jlptLevels.map((row) => {
            const percent = courseProgressPercent(row.lessonCount, row.practicedCount);
            return (
              <HubLevelCard
                key={row.level}
                level={row.level}
                href={`/pronunciation?filter=${encodeURIComponent(`level:${row.level.toLowerCase()}`)}`}
                percent={percent}
                practiced={t("hub.jlptSpeaking.practiced", { percent })}
                lessons={t("hub.jlptSpeaking.lessons", { count: row.lessonCount })}
                scoreLabel={t("hub.jlptSpeaking.averageScore")}
                score={row.averageScore === null ? null : String(row.averageScore)}
                scoreMissing={t("hub.jlptSpeaking.noScore")}
              />
            );
          })}
        </HubShelf>
      </div>
      <div className="mt-3xl">
        <HubShelf
          title={t("hub.shadowingCollections.title")}
          // The shadowing collections' own home lists them all.
          viewAll={{ href: "/shadowing/explore", label: t("hub.shadowingCollections.viewAll") }}
          empty={{ title: t("hub.shadowingCollections.emptyTitle"), body: t("hub.shadowingCollections.emptyBody") }}
        >
          {shadowingCollections.slice(0, 4).map((summary) => {
            const level = formatLevelBand(summary.levelBand, {
              band: (value) => t(`hub.levels.${value}`),
              range: (from, to) => t("hub.levelRange", { from, to }),
            });
            return (
              <HubCollectionCard
                key={summary.collection.id}
                title={summary.collection.title}
                href={`/pronunciation/collections/${summary.collection.slug}`}
                meta={[level, summary.durationMinutes === null ? null : duration(summary.durationMinutes)].filter(Boolean).join(" · ")}
                sentences={t("hub.shadowingCollections.sentences", { count: summary.sentenceCount })}
                glyph={t("hub.shadowingCollections.glyph")}
              />
            );
          })}
        </HubShelf>
      </div>
    </TwoColumnShell>
  );
}
