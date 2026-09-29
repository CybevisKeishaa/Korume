import type { getTranslations } from "@/lib/i18n/server";
import type { PathSummary } from "@/lib/data/collections";
import { formatCompactDuration } from "@/lib/format-course-duration";
import type { HubPathCardData, HubPathCardLabels } from "@/components/shadowing/hub-path-card";
import { toHubPathCard } from "@/components/shadowing/hub-path-shelf";

type PronunciationTranslator = Awaited<ReturnType<typeof getTranslations<"pronunciation">>>;

/** The catalog copy a path card needs; shared by the studio shelf and the paths page. */
export function pathCardLabels(t: PronunciationTranslator): HubPathCardLabels {
  return {
    start: t("hub.paths.start"),
    continue: t("hub.paths.continue"),
    saveFailed: t("hub.paths.saveFailed"),
  };
}

export function pathCards(summaries: PathSummary[], t: PronunciationTranslator): HubPathCardData[] {
  const format = {
    lessons: (count: number) => t("hub.lessons", { count }),
    duration: (minutes: number) => formatCompactDuration(minutes, {
      minutes: (value) => t("hub.paths.durationMinutes", { minutes: value }),
      hours: (value) => t("hub.paths.durationHours", { hours: value }),
      hoursMinutes: (hours, rest) => t("hub.paths.durationHoursMinutes", { hours, minutes: rest }),
    }),
    meta: (lessons: string, duration: string) => t("hub.paths.meta", { lessons, duration }),
    save: (title: string) => t("hub.paths.save", { title }),
    complete: (percent: number) => t("hub.complete", { percent }),
  };
  return summaries.map((summary) => toHubPathCard(summary, format));
}
