import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { getPathname, redirect } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getHubDiscovery, toHubLesson, type HubLesson } from "@/lib/data/shadowing-hub";
import { getPronunciationSearch, SEARCH_PREVIEW_LIMIT, type LibraryItem } from "@/lib/data/pronunciation-search";
import type { PracticeSituation } from "@/lib/data/lesson-taxonomy";
import type { ShadowingCollectionSummary } from "@/lib/data/collections";
import { normalizeSearchQuery, parseSearchType, pronunciationSurface, SEARCH_TYPES, searchHref, type LessonParams, type SearchType } from "@/lib/validation/pronunciation-search";
import { HubLessonResultCard } from "@/components/shadowing/hub-lesson-result-card";
import { PronunciationSearchResults, type PronunciationResultGroup } from "@/components/shadowing/pronunciation-search-results";
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
import { pronunciationDisplaySchema, pronunciationResultLimit, RESULT_MAX_LIMIT, RESULT_PAGE_SIZE, shadowingHubQuerySchema } from "@/lib/validation/shadowing-hub";
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
  // q and filter parse apart, so an over-long q can never drop a valid filter;
  // the q is cut to the schema's own bound instead of rejected.
  const q = normalizeSearchQuery(param("q"));
  const filterParse = shadowingHubQuerySchema.shape.filter.safeParse(param("filter"));
  const filter = filterParse.success ? filterParse.data : undefined;
  const { type, canonical } = parseSearchType(param("type"));
  if (param("type") !== undefined && (!canonical || !q)) {
    // One state, one URL: any other spelling of All, and any type on a page
    // with no search (Browse and Default have no tabs), redirect without it.
    // All ignores `shown`; Browse keeps it (Default ignores it harmlessly).
    const query = Object.fromEntries(Object.entries(searchParams ?? {}).filter((entry): entry is [string, string] => (
      typeof entry[1] === "string" && entry[0] !== "type" && !(q && entry[0] === "shown")
    )));
    redirect({ href: { pathname: "/pronunciation", query }, locale: await getLocale() });
  }
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
  const resultLimit = pronunciationResultLimit(param("shown"));
  const displayStatePromise = displayPromise.then((display) => ({
    display,
    surface: pronunciationSurface({ q, filter, display, type }),
  }));
  const tHubPromise = getTranslations("shadowing");
  const localePromise = getLocale();
  const searchPromise = Promise.all([displayStatePromise, tHubPromise, localePromise]).then(([{ display, surface }, tHub, locale]) => (
    surface.state === "search" ? getPronunciationSearch({
      q: surface.q,
      type: surface.type,
      settings: { filter, ...display },
      limit: surface.type ? resultLimit : SEARCH_PREVIEW_LIMIT,
      // Situations match their label in the request locale (and their slug).
      situationLabels: Object.fromEntries(Object.keys(enShadowing.situations).map((slug) => [slug, tHub(`situations.${slug}` as TaxonomyTranslationKey)])),
      locale,
    }) : null
  ));
  const learningPromise = getLearningPaths();
  const goalsPromise = getPracticeGoals();
  const weeklyMetricsPromise = getWeeklyPronunciationMetrics(now);
  const senseiPromise = Promise.all([goalsPromise, learningPromise, weeklyMetricsPromise])
    .then(([goals, learning, weeklyMetrics]) => getSenseiRecommendation(goals, learning.paths, weeklyMetrics.weakest));
  const [t, tCommon, tHub, hub, search, displayState, preferences, learning, locale, situations, goals, weeklyMetrics, shadowingCollections, jlptLevels, today, weekly, recent, sensei] = await Promise.all([
    getTranslations("pronunciation"),
    getTranslations("common"),
    tHubPromise,
    // A search reads its own rows; here it needs only the chips' taxonomy.
    displayStatePromise.then(({ display, surface }) => surface.state === "search" ? getHubDiscovery({}) : getHubDiscovery({
      filter,
      ...display,
      browse: surface.state === "browse",
      limit: surface.state === "browse" ? resultLimit : 4,
    })),
    searchPromise,
    displayStatePromise,
    preferencesPromise,
    learningPromise,
    localePromise,
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
  const { display, surface } = displayState;
  const resultMode = surface.state !== "default";
  const discovery = surface.state === "browse" ? hub.discovery : null;
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
  // "Show more" in Browse is the same URL one page longer: the URL's own
  // filter (even one the data layer did not know, so the page stays Browse)
  // plus the display values the URL set, so nothing resets.
  const moreHref = discovery?.hasMore && resultLimit < RESULT_MAX_LIMIT ? (() => {
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    for (const key of ["sort", "duration", "hideCompleted"]) { const value = param(key); if (value) params.set(key, value); }
    params.set("shown", String(resultLimit + RESULT_PAGE_SIZE));
    return `/pronunciation?${params.toString()}`;
  })() : null;

  // One mapping per card kind, shared by the curated shelves and the results.
  const lessonCard = (lesson: HubLesson) => (
    <HubLessonResultCard
      key={lesson.id}
      lesson={lesson}
      noThumbnailLabel={tCommon("noThumbnail")}
      // Rounded up, as the featured hero rounds a lesson's minutes.
      durationLabel={lesson.durationSeconds ? duration(Math.ceil(lesson.durationSeconds / 60)) : null}
    />
  );
  const situationTile = (situation: PracticeSituation, label = tHub(`situations.${situation.slug}` as TaxonomyTranslationKey)) => (
    <HubSituationTile
      key={situation.slug}
      label={label}
      icon={situation.icon}
      href={`/pronunciation?filter=${encodeURIComponent(`situation:${situation.slug}`)}`}
      action={t("hub.situations.start")}
      actionLabel={t("hub.situations.startLabel", { situation: label })}
    />
  );
  const collectionCard = (summary: ShadowingCollectionSummary) => {
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
  };
  const libraryCard = (item: LibraryItem) => item.kind === "collection" ? collectionCard(item.summary) : situationTile(item.situation, item.label);

  // Lesson settings ride along on every search link: preserved, ignored outside lessons.
  const lessonParams: LessonParams = { filter, sort: param("sort"), duration: param("duration"), hideCompleted: param("hideCompleted") };
  const searchResults = surface.state === "search" && search ? (() => {
    const { q: term, type: active } = surface;
    const rows: Record<SearchType, ReactNode[]> = {
      lessons: search.lessons?.items.map(lessonCard) ?? [],
      paths: search.paths ? pathCards(search.paths.items, t).map((path) => <HubPathCard key={path.id} path={path} labels={cards} />) : [],
      goals: search.goals ? goalCards(search.goals.items, t, recommendedGoalId).map((goal) => <HubPathCard key={goal.id} path={goal} labels={cards} />) : [],
      library: search.library?.items.map(libraryCard) ?? [],
    };
    const groups: PronunciationResultGroup[] = SEARCH_TYPES.filter((key) => active === null || key === active).map((key) => {
      const title = t(`hub.search.groups.${key}`);
      return {
        key,
        title,
        seeAll: active === null ? { href: searchHref({ q: term, type: key, lesson: lessonParams }), label: t("hub.search.seeAll", { group: title }) } : null,
        items: rows[key],
      };
    });
    const page = active ? search[active] : undefined;
    return {
      heading: t("hub.search.heading", { q: term }),
      tabs: {
        label: t("hub.search.tabsLabel"),
        items: [
          { key: "all" as const, label: t("hub.search.tabs.all"), href: searchHref({ q: term, type: null, lesson: lessonParams }), current: active === null },
          ...SEARCH_TYPES.map((key) => ({
            key,
            label: t(`hub.search.tabs.${key}`, { count: search.counts[key] }),
            href: searchHref({ q: term, type: key, lesson: lessonParams }),
            current: active === key,
          })),
        ],
      },
      groups,
      preview: active === null,
      more: active && page && page.items.length < page.total && resultLimit < RESULT_MAX_LIMIT
        ? { href: searchHref({ q: term, type: active, lesson: lessonParams, shown: resultLimit + RESULT_PAGE_SIZE }), label: t(`hub.search.showMore.${active}`), pendingLabel: t("hub.search.loadingMore") }
        : null,
      empty: t("hub.search.empty", { q: term }),
    };
  })() : null;
  const browseResults = discovery ? {
    // What the data layer applied, not the raw URL: an unknown filter browses everything.
    heading: discovery.activeFilter ? tHub("hub.search.results") : t("hub.allLessons"),
    summary: discovery.hasMore ? t("hub.showingFirstLessons", { count: discovery.lessons.length }) : undefined,
    tabs: null,
    groups: [{ key: "lessons" as const, title: t("hub.allLessons"), seeAll: null, items: discovery.lessons.map(lessonCard) }],
    preview: false,
    more: moreHref ? { href: moreHref, label: t("hub.showMore"), pendingLabel: t("hub.loadingMore") } : null,
    empty: discovery.activeFilter ? tHub("hub.search.noResults") : t("hub.noLessonsForDisplay"),
  } : null;
  const results = searchResults ?? browseResults;
  // The lesson controls belong to lessons: on All they say so, and on a tab of
  // another kind (paths, goals, library) they are not offered at all.
  const searchType = surface.state === "search" ? surface.type : undefined;
  const lessonControlsShown = searchType === undefined || searchType === null || searchType === "lessons";
  const knownFilters = [...hub.filters, ...JLPT_LEVELS.map((level) => ({ kind: "level" as const, slug: level.toLowerCase() }))];
  const appliedFilter = surface.state === "search"
    ? (filter && knownFilters.some((known) => `${known.kind}:${known.slug}` === filter) ? filter : null)
    : discovery?.activeFilter ?? null;

  // One set of controls, rendered as two halves: the heading row spans the
  // rail (frame 37:5331), the hero and results sit in the main column.
  const discoveryControls = (part: "controls" | "results") => (
    <HubDiscoveryControls
      part={part}
      // The studio adds the JLPT levels to the Hub's taxonomy chips; a level's label is its code.
      filters={knownFilters.map((known) => ({
        ...known,
        label: known.kind === "level"
          ? known.slug.toUpperCase()
          : tHub(`${known.kind === "situation" ? "situations" : "sources"}.${known.slug}` as TaxonomyTranslationKey),
      }))}
      query={q ?? ""}
      activeFilter={appliedFilter}
      // The page renders its own result surface below.
      results={null}
      action={getPathname({ href: "/pronunciation", locale })}
      basePath="/pronunciation"
      heading={(
        <header>
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{t("hub.eyebrow")}</p>
          <h1 className="mt-xs text-title font-semibold text-foreground">{t("hub.title")}</h1>
          <p className="mt-sm text-body text-muted-foreground">{t("hub.subtitle")}</p>
        </header>
      )}
      filterToggleLabel={!lessonControlsShown ? undefined : surface.state === "search" ? t("hub.search.lessonFilterToggle") : t("hub.filterToggleLabel")}
      preservedParams={{ sort: param("sort"), duration: param("duration"), hideCompleted: param("hideCompleted") }}
      // A chip on the Lessons tab filters that tab; a new search starts on All.
      filterHrefParams={searchType === "lessons" ? { type: "lessons" } : undefined}
      toolbar={lessonControlsShown ? (
        <HubDisplayPanel
          value={display}
          labels={{
            trigger: searchType === null ? t("hub.search.lessonControls") : t("hub.display.trigger"), triggerCustomised: t.raw("hub.display.triggerCustomised") as string, title: t("hub.display.title"), sort: t("hub.display.sort"),
            recommended: t("hub.display.recommended"), newest: t("hub.display.newest"), shortest: t("hub.display.shortest"), inProgress: t("hub.display.inProgress"),
            duration: t("hub.display.duration"), anyDuration: t("hub.display.anyDuration"), underTen: t("hub.display.underTen"), tenToThirty: t("hub.display.tenToThirty"), overThirty: t("hub.display.overThirty"),
            hideCompleted: t("hub.display.hideCompleted"), apply: t("hub.display.apply"), reset: t("hub.display.reset"), close: t("hub.display.close"), saveFailed: t("hub.display.saveFailed"),
          }}
        />
      ) : undefined}
      beforeResults={resultMode ? undefined : (
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
              resuming: course.resume !== null,
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
      {results ? <PronunciationSearchResults {...results} /> : null}
      {!resultMode ? <>
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
          {situations.map((situation) => situationTile(situation))}
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
          {shadowingCollections.slice(0, 4).map(collectionCard)}
        </HubShelf>
      </div>
      </> : null}
    </TwoColumnShell>
  );
}
