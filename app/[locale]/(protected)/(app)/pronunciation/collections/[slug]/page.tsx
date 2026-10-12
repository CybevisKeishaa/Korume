import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { collectionMeta, getCollectionBySlug, getCollectionProgress, listCollectionLessons } from "@/lib/data/collections";
import { formatCourseDuration, formatHours, formatLevelBand } from "@/lib/format-course-duration";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubCourseProgress } from "@/components/shadowing/hub-course-progress";
import { HubLessonCard } from "@/components/shadowing/hub-lesson-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const collection = await getCollectionBySlug(params.slug);
  return collection ? { title: collection.title } : {};
}

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const [t, tCommon, locale, collection] = await Promise.all([
    getTranslations("pronunciation"),
    getTranslations("common"),
    getLocale(),
    getCollectionBySlug(params.slug),
  ]);
  // A curriculum is reached through the Dashboard journey, never as a pronunciation collection (port-dashboard C1).
  if (!collection || collection.kind === "curriculum") notFound();
  const [lessons, progress] = await Promise.all([listCollectionLessons(collection.id), getCollectionProgress(collection.id)]);
  const meta = collectionMeta(lessons);
  const eyebrow = collection.kind === "path" ? t("hub.course") : collection.kind === "goal" ? t("hub.goal") : t("hub.collection");
  const duration = meta.durationMinutes === null ? null : formatCourseDuration(meta.durationMinutes, {
    minutes: (value) => t("hub.durationMinutes", { minutes: value }),
    hours: (value) => t("hub.durationHours", { hours: value, hoursText: formatHours(value, locale) }),
  });
  const levelBand = formatLevelBand(meta.levelBand, {
    band: (value) => t(`hub.levels.${value}`),
    range: (from, to) => t("hub.levelRange", { from, to }),
  });

  return (
    <TwoColumnShell railLabel={collection.title} className="py-2xl">
      <Link href="/pronunciation" className="text-body text-primary-strong hover:underline">{t("hub.backToPronunciation")}</Link>
      <header className="mt-md">
        <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{eyebrow}</p>
        <h1 className="mt-xs text-title font-semibold text-foreground">{collection.title}</h1>
        {collection.description ? <p className="mt-sm text-body text-muted-foreground">{collection.description}</p> : null}
        <dl className="mt-md flex flex-wrap gap-md text-caption text-muted-foreground">
          {levelBand ? <div className="flex gap-xs"><dt>{t("hub.level")}</dt><dd>{levelBand}</dd></div> : null}
          {duration ? <div className="flex gap-xs"><dt>{t("hub.duration")}</dt><dd>{duration}</dd></div> : null}
          {meta.jlptRange ? <div className="flex gap-xs"><dt>{t("hub.jlpt")}</dt><dd>{meta.jlptRange}</dd></div> : null}
        </dl>
        <HubCourseProgress
          total={progress.total}
          completed={progress.completed}
          labels={{ complete: (percent) => t("hub.complete", { percent }), lessons: (completed, total) => t("hub.courseProgress", { completed, total }) }}
        />
      </header>
      {lessons.length ? (
        <ul className="mt-xl grid grid-cols-1 gap-md sm:grid-cols-2">
          {lessons.map((lesson) => (
            <HubLessonCard
              key={lesson.id}
              lesson={{ id: lesson.id, youtubeVideoId: lesson.youtube_video_id, title: lesson.title, durationSeconds: lesson.duration_seconds, thumbnailUrl: lesson.thumbnail_url, jlptLevelEstimate: lesson.jlpt_level_estimate }}
              href={`/shadowing/${lesson.id}`}
              actionLabel={t("hub.startLesson")}
              noThumbnailLabel={tCommon("noThumbnail")}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-xl text-body text-muted-foreground">{t("hub.emptyCollection")}</p>
      )}
    </TwoColumnShell>
  );
}
