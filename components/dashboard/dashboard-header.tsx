import { getPathname, Link, useLocale, useTranslations } from "@/lib/i18n";
import type { Daypart } from "@/lib/dashboard/daypart";
import { DashboardIcon } from "./dashboard-icon";

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
  const locale = useLocale();
  return (
    <header className="dashboard-header">
      <div>
        <p className="dash-eyebrow">{t("header.eyebrow", { weekday, daypart: t(`header.daypart.${daypart}`) })}</p>
        <h1 className="dash-display dash-h1 mt-[calc(8*var(--d))]">{name ? t("header.title", { name }) : t("header.titleNoName")}</h1>
        <p className="dash-meta mt-[calc(4*var(--d))] text-muted-foreground">{t("header.subtitle")}</p>
      </div>
      <div className="dashboard-header-tools">
        {/* Lesson search is the search that exists today: it hands off to the Lessons hub's own query. */}
        <form role="search" action={getPathname({ href: "/shadowing", locale })} className="dashboard-search">
          <DashboardIcon name="search" className="dash-icon dash-icon--sm" />
          <input type="search" name="q" aria-label={t("header.search")} placeholder={t("header.searchPlaceholder")} />
        </form>
        {streak > 0 && <a className="dashboard-streak" href="#learning-activity"><DashboardIcon name="flame" className="dash-icon dash-icon--sm" />{t("header.streak", { count: streak })}</a>}
        <Link href="/profile" className="dashboard-avatar" aria-label={nav("profile")}>
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- Profile's shared resolver permits storage and OAuth origins.
            ? <img src={avatarUrl} alt="" />
            : <span aria-hidden="true">{(name && Array.from(name)[0]?.toUpperCase()) || "•"}</span>}
        </Link>
      </div>
    </header>
  );
}
