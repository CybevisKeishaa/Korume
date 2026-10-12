import { Link, useTranslations } from "@/lib/i18n";
import { DashboardCard } from "./dashboard-card";
import { DashboardIcon, type DashboardIconKey } from "./dashboard-icon";

export interface QuickAccessProps {
  review: { href: string; due: number } | null;
}

export function QuickAccess({ review }: QuickAccessProps) {
  const t = useTranslations("dashboard");
  const nav = useTranslations("nav");
  // Figma's six tiles less Vocabulary, which A10 keeps hidden; Roadmap is the Journey screen.
  const items: { href: string; icon: DashboardIconKey; label: string; detail: string | null }[] = [
    { href: review?.href ?? "/kanji/review", icon: "book", label: nav("review"), detail: review ? (review.due > 0 ? t("quick.due", { count: review.due }) : t("quick.caughtUp")) : null },
    { href: "/mining", icon: "wand", label: nav("mining"), detail: null },
    { href: "/roadmap", icon: "mountain", label: nav("roadmap"), detail: null },
    { href: "/conversation", icon: "message", label: nav("speaking"), detail: null },
    { href: "/shadowing", icon: "clapper", label: nav("lessons"), detail: null },
  ];

  return (
    <DashboardCard id="quick-access" area="quick" eyebrow={t("quick.eyebrow")} bare>
      <nav aria-label={t("quick.eyebrow")} className="dashboard-quick">
        {items.map((item) => (
          <Link key={item.href + item.label} href={item.href} className="dashboard-quick-link">
            <DashboardIcon name={item.icon} className="dash-icon dash-icon--lg" />
            <div><span>{item.label}</span>{item.detail && <span className="dash-small block font-normal text-muted-foreground">{item.detail}</span>}</div>
          </Link>
        ))}
      </nav>
    </DashboardCard>
  );
}
