import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getPathname } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getHubDiscovery, toHubLesson } from "@/lib/data/shadowing-hub";
import { getFeaturedCourse } from "@/lib/data/collections";
import { formatCourseDuration, formatHours, formatLevelBand } from "@/lib/format-course-duration";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubDiscoveryControls } from "@/components/shadowing/hub-discovery-controls";
import { HubFeaturedHero } from "@/components/shadowing/hub-featured-hero";
import { HubContinueStrip } from "@/components/shadowing/hub-continue-strip";
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
  const [t, tCommon, tHub, hub, course, locale] = await Promise.all([
    getTranslations("pronunciation"),
    getTranslations("common"),
    getTranslations("shadowing"),
    getHubDiscovery({ query: hubQuery.q, filter: hubQuery.filter }),
    getFeaturedCourse(),
    getLocale(),
  ]);
  const duration = (minutes: number) => formatCourseDuration(minutes, {
    minutes: (value) => t("hub.durationMinutes", { minutes: value }),
    hours: (value) => t("hub.durationHours", { hours: value, hoursText: formatHours(value, locale) }),
  });
  const levelBand = formatLevelBand(course?.levelBand ?? null, {
    band: (value) => t(`hub.levels.${value}`),
    range: (from, to) => t("hub.levelRange", { from, to }),
  });

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
        beforeResults={(
          <>
            <HubFeaturedHero
              course={course ? {
                title: course.collection.title,
                description: course.collection.description,
                total: course.total,
                completed: course.completed,
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
    </TwoColumnShell>
  );
}
