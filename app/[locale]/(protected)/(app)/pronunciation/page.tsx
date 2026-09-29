import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getPathname } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getHubDiscovery, toHubLesson } from "@/lib/data/shadowing-hub";
import { getLearningPaths, getPracticeGoals, getSenseiRecommendation, getShadowingCollections, recommendedPracticeGoalId } from "@/lib/data/collections";
import { getJlptSpeakingSummary, getRecentPractice, getTodaySpeaking, getWeeklyImprovement, getWeeklyPronunciationMetrics, vnDaysAgo } from "@/lib/data/pronunciation-metrics";
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
import { HubSpeakingRail } from "@/components/shadowing/hub-speaking-rail";
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
  const now = new Date();
  const param = (key: string) => typeof searchParams?.[key] === "string" ? searchParams[key] as string : undefined;
  const query = shadowingHubQuerySchema.safeParse({ q: param("q"), filter: param("filter") });
  const hubQuery = query.success ? query.data : {};
  // Parsed on their own: every display field falls back alone, never fails.
  const urlDisplay = pronunciationDisplaySchema.parse({ sort: param("sort"), duration: param("duration"), hideCompleted: param("hideCompleted") });
  // The URL wins when it sets any display value; otherwise the saved profile applies.
  const urlControlsDisplay = ["sort", "duration", "hideCompleted"].some((key) => typeof searchParams?.[key] === "string");
  const preferencesPromise = getMyPreferences();
  const displayPromise = urlControlsDisplay
    ? Promise.resolve(urlDisplay)
    : preferencesPromise.then((preferences) => ({
      sort: preferences?.pronunciationSort ?? DEFAULT_PREFERENCES.pronunciationSort,
      duration: preferences?.pronunciationDuration ?? DEFAULT_PREFERENCES.pronunciationDuration,
      hideCompleted: preferences?.pronunciationHideCompleted ?? DEFAULT_PREFERENCES.pronunciationHideCompleted,
    }));
  const learningPromise = getLearningPaths();
  const goalsPromise = getPracticeGoals();
  const weeklyMetricsPromise = getWeeklyPronunciationMetrics(now);
  const senseiPromise = Promise.all([goalsPromise, learningPromise, weeklyMetricsPromise])
    .then(([goals, learning, weeklyMetrics]) => getSenseiRecommendation(goals, learning.paths, weeklyMetrics.weakest));
  const [t, tCommon, tHub, hub, display, preferences, learning, locale, situations, goals, weeklyMetrics, shadowingCollections, jlptLevels, today, weekly, recent, sensei] = await Promise.all([
    getTranslations("pronunciation"),
    getTranslations("common"),
    getTranslations("shadowing"),
    displayPromise.then((value) => getHubDiscovery({ query: hubQuery.q, filter: hubQuery.filter, ...value })),
    displayPromise,
    preferencesPromise,
    learningPromise,
    getLocale(),
    listPracticeSituations(),
    goalsPromise,
    weeklyMetricsPromise,
    getShadowingCollections(),
    getJlptSpeakingSummary(),
    getTodaySpeaking(now),
    getWeeklyImprovement(now),
    getRecentPractice(3),
    senseiPromise,
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
  const goal = preferences?.dailyMinutes ?? DEFAULT_PREFERENCES.dailyMinutes;
  const metricLabel = (metric: "accuracy" | "pitch" | "rhythm") => t(`hub.rail.metrics.${metric}`);
  const formatDelta = (delta: number | null) => delta === null ? null : delta > 0 ? `+${delta}%` : delta < 0 ? `−${Math.abs(delta)}%` : "0%";
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
  const relativeDay = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const continueLesson = recent[0]?.lesson ?? course?.next ?? null;

  // One set of controls, rendered as two halves: the heading row spans the
  // rail (frame 37:5331), the hero and results sit in the main column.
  const discoveryControls = (part: "controls" | "results") => (
    <HubDiscoveryControls
      part={part}
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
      preservedParams={{ sort: param("sort"), duration: param("duration"), hideCompleted: param("hideCompleted") }}
      toolbar={(
        <HubDisplayPanel
          value={display}
          labels={{
            trigger: t("hub.display.trigger"), triggerCustomised: t.raw("hub.display.triggerCustomised") as string, title: t("hub.display.title"), sort: t("hub.display.sort"),
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
  );

  return (
    <TwoColumnShell
      railLabel={t("hub.rail.label")}
      className="py-2xl"
      header={discoveryControls("controls")}
      rail={<HubSpeakingRail
        today={{
          title: t("hub.rail.today.title"), minutes: today.minutes, minutesUnit: t("hub.rail.today.minutesUnit"),
          minutesLabel: t("hub.rail.today.minutesLabel", { minutes: today.minutes, goal }),
          goalPercent: Math.min(100, Math.round(100 * today.minutes / goal)),
          lessons: t("hub.rail.today.lessons", { count: today.lessonsCompleted }), scoreLabel: t("hub.rail.today.averageScore"),
          score: today.averageScore === null ? null : String(today.averageScore), scoreMissing: t("hub.rail.scoreMissing"),
          continue: continueLesson ? { href: `/shadowing/${continueLesson.id}`, label: t("hub.rail.today.continue") } : null,
        }}
        weekly={{
          title: t("hub.rail.weekly.title"), heading: t("hub.rail.weekly.heading"), notEnoughData: t("hub.rail.notEnoughData"),
          metrics: (["accuracy", "pitch", "rhythm"] as const).map((metric) => ({ label: metricLabel(metric), value: formatDelta(weekly.deltas[metric]) })),
          trend: {
            label: t("hub.rail.weekly.chartLabel"), empty: t("hub.rail.weekly.chartEmpty"),
            points: weekly.trend.map((point) => {
              const day = new Date(`${point.day}T00:00:00+07:00`);
              // The window is the 14 VN days ending today: 13 days back is the left edge.
              return { x: Math.max(0, Math.min(1, 1 - vnDaysAgo(day, now) / 13)), score: point.score, label: t("hub.rail.weekly.point", { date: shortDate.format(day), score: point.score }) };
            }),
          },
        }}
        sensei={{
          title: t("hub.rail.sensei.title"), heading: t("hub.rail.sensei.heading"), empty: t("hub.rail.sensei.empty"),
          body: sensei ? sensei.focus
            ? t("hub.rail.sensei.focus", { metric: metricLabel(sensei.focus), percent: Math.round(sensei.knownRatio * 100) })
            : t("hub.rail.sensei.stretch", { percent: Math.round(sensei.knownRatio * 100) }) : null,
          pick: sensei ? {
            eyebrow: t(sensei.home ? (sensei.home.kind === "goal" ? "hub.rail.sensei.recommendedGoal" : "hub.rail.sensei.recommendedCourse") : "hub.rail.sensei.recommendedLesson"),
            title: sensei.home?.title ?? sensei.lesson.title,
            detail: sensei.home ? t("hub.rail.sensei.lessonDetail", { number: sensei.home.lessonNumber, title: sensei.lesson.title }) : null,
            href: `/shadowing/${sensei.lesson.id}`, action: t("hub.rail.sensei.start"), actionLabel: t("hub.rail.sensei.startLabel", { title: sensei.lesson.title }),
          } : null,
        }}
        recent={{
          title: t("hub.rail.recent.title"), empty: t("hub.rail.recent.empty"), scoreMissing: t("hub.rail.scoreMissing"), scoreLabel: t("hub.rail.recent.scoreLabel"),
          rows: recent.map((row) => {
            // A session the database stamped a moment after this request's `now` is still today.
            const days = Math.max(0, vnDaysAgo(new Date(row.practicedAt), now));
            const when = days > 6 ? shortDate.format(new Date(row.practicedAt)) : relativeDay.format(-days, "day");
            return { id: row.lesson.id, title: row.lesson.title, href: `/shadowing/${row.lesson.id}`, when: when.charAt(0).toLocaleUpperCase(locale) + when.slice(1), dateTime: row.practicedAt, score: row.averageScore === null ? null : String(row.averageScore) };
          }),
        }}
      />}
    >
      {discoveryControls("results")}
      <div className="mt-3xl">
        <HubPathShelf
          title={t("hub.paths.title")}
          // The frame shelves four; "View all" holds the rest.
          paths={pathCards(learning.paths.slice(0, 4), t)}
          labels={cards}
          viewAll={{ href: "/pronunciation/paths", label: t("hub.paths.viewAll"), accessibleSuffix: t("hub.paths.title") }}
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
          viewAll={{ href: "/shadowing/explore", label: t("hub.shadowingCollections.viewAll"), accessibleSuffix: t("hub.shadowingCollections.title") }}
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
                sentences={summary.sentenceCount === null ? null : t("hub.shadowingCollections.sentences", { count: summary.sentenceCount })}
                glyph={t("hub.shadowingCollections.glyph")}
              />
            );
          })}
        </HubShelf>
      </div>
    </TwoColumnShell>
  );
}
