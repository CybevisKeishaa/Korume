import { LessonHeaderFrame } from "@/components/shadowing-workspace/lesson-header-frame";
import { useTranslations } from "@/lib/i18n";

/**
 * Summary's header (spec §7.1, plan correction C3): Back to Lesson, title, SUMMARY eyebrow and the mode bar. No
 * bookmark or overflow menu — both read workspace context, which Summary never imports.
 */
export function SummaryHeader({ videoId, title, backHref }: { videoId: string; title: string; backHref: string }) {
  const t = useTranslations("shadowing.lessonSummary");
  return (
    <LessonHeaderFrame
      videoId={videoId}
      backHref={backHref}
      backLabel={t("backToLesson")}
      title={title}
      eyebrow={t("eyebrow")}
    />
  );
}
