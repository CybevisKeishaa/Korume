import { useFormatter, useTranslations } from "@/lib/i18n";
import type { ProfileView } from "@/lib/profile/view";
import { CARD, EYEBROW } from "./card-styles";
import { ProfileIcon, type ProfileIconKey } from "./profile-icon";
import { HoursInfo } from "./hours-info";
import { formatStudyDuration } from "./format";

export function QuickStats({ stats }: { stats: ProfileView["stats"] }) {
  const t = useTranslations("profile");
  const format = useFormatter();
  const { hours, minutes } = formatStudyDuration(stats.studySeconds);
  const rows: { icon: ProfileIconKey; label: string; value: string }[] = [
    { icon: "streak", label: t("stats.streak"), value: t("stats.streakValue", { count: stats.streakCurrent }) },
    { icon: "level", label: t("stats.level"), value: t("stats.levelValue", { level: stats.level }) },
    { icon: "xp", label: t("stats.xp"), value: format.number(stats.totalXp) },
    { icon: "video", label: t("stats.videoLessons"), value: format.number(stats.videoLessonsCompleted) },
    { icon: "words", label: t("stats.words"), value: format.number(stats.wordsLearned) },
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
            <dt className="flex items-center gap-xs text-muted-foreground"><ProfileIcon name={r.icon} />{r.label}</dt>
            <dd className="font-semibold">{r.value}</dd>
          </div>
        ))}
        <div className={row}>
          <dt className="flex items-center gap-xs text-muted-foreground"><ProfileIcon name="hours" />{t("stats.hours")}</dt>
          <dd className="flex items-center gap-xs font-semibold">
            {t("stats.hoursValue", { hours, minutes })}
            <HoursInfo label={t("stats.hoursInfo")} hint={hint} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
