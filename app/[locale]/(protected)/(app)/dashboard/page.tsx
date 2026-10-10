import type { Metadata } from "next";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { QuickAccess } from "@/components/dashboard/quick-access";
import { CardSkeleton } from "@/components/dashboard/dashboard-card";
import { loadCard } from "@/components/dashboard/card-boundary";
import { getDashboardContext } from "@/lib/data/dashboard/context";
import { getStreakFact } from "@/lib/data/dashboard/facts";
import { getReviewSummary } from "@/lib/data/dashboard/review";
import { daypartAt } from "@/lib/dashboard/daypart";

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "dashboard" });
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

async function QuickAccessCard() {
  const review = await loadCard("quick", getReviewSummary);
  return <QuickAccess review={review.kind === "ok" ? review.data : null} />;
}

export default async function DashboardPage({ params }: { params: { locale: Locale } }) {
  const contextState = await loadCard("context", getDashboardContext);
  const context = contextState.kind === "ok" ? contextState.data : null;
  const streak = context ? await loadCard("header_streak", () => getStreakFact(context)) : { kind: "unavailable" } as const;
  const now = context?.now ?? new Date();
  const timeZone = context?.timeZone ?? "UTC";
  const weekday = new Intl.DateTimeFormat(params.locale, { weekday: "long", timeZone }).format(now);
  return (
    <Container className="py-xl">
      <div className="dashboard-layout">
        <DashboardHeader weekday={weekday} daypart={daypartAt(now, timeZone)} name={context?.name ?? null} avatarUrl={context?.avatarUrl ?? null} streak={streak.kind === "ok" ? streak.data.current : 0} />
        <div className="dashboard-grid">
          <div className="dashboard-row dashboard-row--lead" />
          <div className="dashboard-row dashboard-row--three" />
          <div className="dashboard-row dashboard-row--trend" />
          <div className="dashboard-row dashboard-row--achievements" />
          <div className="dashboard-row dashboard-row--quick">
            <Suspense fallback={<CardSkeleton area="quick" />}><QuickAccessCard /></Suspense>
          </div>
        </div>
      </div>
    </Container>
  );
}
