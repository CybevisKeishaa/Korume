import { useId } from "react";
import { useFormatter, useTranslations } from "@/lib/i18n";
import type { ProfileView } from "@/lib/profile/view";
import { CARD, EYEBROW } from "./card-styles";
import { formatStudyDuration } from "./format";

export function QuickStats({ stats }: { stats: ProfileView["stats"] }) {
  const t = useTranslations("profile");
  const format = useFormatter();
  const hintId = useId();
  const { hours, minutes } = formatStudyDuration(stats.studySeconds);
  const rows: { label: string; value: string }[] = [
    { label: t("stats.streak"), value: t("stats.streakValue", { count: stats.streakCurrent }) },
    { label: t("stats.level"), value: t("stats.levelValue", { level: stats.level }) },
    { label: t("stats.xp"), value: format.number(stats.totalXp) },
    { label: t("stats.videoLessons"), value: format.number(stats.videoLessonsCompleted) },
    { label: t("stats.words"), value: format.number(stats.wordsLearned) },
  ];
  const hint = stats.trackedSince
    ? t("stats.trackedSince", { date: format.dateTime(new Date(stats.trackedSince), { day: "numeric", month: "short", year: "numeric" }) })
    : t("stats.trackingStarts");
  const row = "flex items-baseline justify-between gap-sm text-sm";
  return (
    <section className={CARD} aria-labelledby="profile-stats">
      <h2 id="profile-stats" className={EYEBROW}>{t("stats.title")}</h2>
      <dl className="mt-sm grid gap-sm">
        {rows.map((r) => (
          <div key={r.label} className={row}>
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-semibold">{r.value}</dd>
          </div>
        ))}
        <div className={row}>
          <dt className="text-muted-foreground">{t("stats.hours")}</dt>
          <dd className="group relative flex items-center gap-xs font-semibold">
            {t("stats.hoursValue", { hours, minutes })}
            <button
              type="button"
              aria-label={t("stats.hoursInfo")}
              aria-describedby={hintId}
              className="inline-flex size-5 items-center justify-center rounded-full border border-border text-xs text-muted-foreground"
            >
              i
            </button>
            <span
              id={hintId}
              role="tooltip"
              className="invisible absolute end-0 top-full z-popover mt-2xs w-56 rounded-md bg-foreground px-xs py-2xs text-caption font-normal text-background shadow-overlay group-focus-within:visible group-hover:visible"
            >
              {hint}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
