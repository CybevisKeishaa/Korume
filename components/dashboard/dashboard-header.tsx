import { Link, useTranslations } from "@/lib/i18n";
import type { Daypart } from "@/lib/dashboard/daypart";

export interface DashboardHeaderProps {
  weekday: string;
  daypart: Daypart;
  name: string | null;
  avatarUrl: string | null;
  streak: number;
}

export function DashboardHeader({ weekday, daypart, name, avatarUrl, streak }: DashboardHeaderProps) {
  const t = useTranslations("dashboard");
  const nav = useTranslations("nav");
  return (
    <header className="dashboard-header">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-strong">
          {t("header.eyebrow", { weekday, daypart: t(`header.daypart.${daypart}`) })}
        </p>
        <h1 className="mt-xs text-3xl font-bold">{name ? t("header.title", { name }) : t("header.titleNoName")}</h1>
        <p className="mt-xs text-muted-foreground">{t("header.subtitle")}</p>
      </div>
      <div className="flex items-center gap-sm">
        {streak > 0 && <a className="dashboard-streak" href="#learning-activity">{t("header.streak", { count: streak })}</a>}
        <Link href="/profile" className="dashboard-avatar" aria-label={nav("profile")}>
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- Profile's shared resolver permits storage and OAuth origins.
            ? <img src={avatarUrl} alt="" />
            : <span aria-hidden="true">•</span>}
        </Link>
      </div>
    </header>
  );
}
