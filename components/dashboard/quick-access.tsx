import { Link, useTranslations } from "@/lib/i18n";
import { DashboardCard } from "./dashboard-card";

export interface QuickAccessProps {
  review: { href: string; due: number } | null;
}

export function QuickAccess({ review }: QuickAccessProps) {
  const t = useTranslations("dashboard");
  const nav = useTranslations("nav");
  const items = [
    { href: review?.href ?? "/kanji/review", label: nav("review"), detail: review ? (review.due > 0 ? t("quick.due", { count: review.due }) : t("quick.caughtUp")) : null },
    { href: "/mining", label: nav("mining"), detail: null },
    { href: "/conversation", label: nav("speaking"), detail: null },
    { href: "/shadowing", label: nav("lessons"), detail: null },
  ] as const;

  return (
    <DashboardCard id="quick-access" area="quick" eyebrow={t("quick.eyebrow")}>
      <nav aria-label={t("quick.eyebrow")} className="dashboard-quick">
        {items.map((item) => (
          <Link key={item.href + item.label} href={item.href} className="dashboard-quick-link">
            <span>{item.label}</span>
            {item.detail && <span className="text-sm text-muted-foreground">{item.detail}</span>}
          </Link>
        ))}
      </nav>
    </DashboardCard>
  );
}
