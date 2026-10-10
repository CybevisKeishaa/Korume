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
import { ContinueCard } from "@/components/dashboard/continue-card";
import { MissionCard } from "@/components/dashboard/mission-card";
import { JourneyCard } from "@/components/dashboard/journey-card";
import { getContinueLearning } from "@/lib/data/dashboard/facts";
import { getCurriculumJourney } from "@/lib/data/dashboard/journey";
import { getDailyMission } from "@/lib/data/dashboard/mission";

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "dashboard" });
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

async function QuickAccessCard() {
  const review = await loadCard("quick", getReviewSummary);
  return <QuickAccess review={review.kind === "ok" ? review.data : null} />;
}

async function ContinueLearningCard({ context }: { context: Awaited<ReturnType<typeof getDashboardContext>> }) {
  const state = context ? await loadCard("continue", () => getContinueLearning(context)) : { kind: "unavailable" } as const;
  return <ContinueCard error={state.kind === "error"} view={state.kind === "ok" ? state.data : { kind: "onboarding" }} />;
}

async function JourneyPanel() {
  const state = await loadCard("journey", getCurriculumJourney);
  return state.kind === "ok" ? <JourneyCard view={state.data} /> : <JourneyCard error={state.kind === "error"} view={{ kind: "authoring" }} />;
}

async function MissionPanel({ promise }: { promise: ReturnType<typeof getDailyMission> }) {
  return <MissionCard state={await promise} />;
}

export default async function DashboardPage({ params }: { params: { locale: Locale } }) {
  const contextState = await loadCard("context", getDashboardContext);
  const context = contextState.kind === "ok" ? contextState.data : null;
  const streak = context ? await loadCard("header_streak", () => getStreakFact(context)) : { kind: "unavailable" } as const;
  const now = context?.now ?? new Date();
  const timeZone = context?.timeZone ?? "UTC";
  const weekday = new Intl.DateTimeFormat(params.locale, { weekday: "long", timeZone }).format(now);
  const missionPromise = getDailyMission();
  return (
    <Container className="py-xl">
      <div className="dashboard-layout">
        <DashboardHeader weekday={weekday} daypart={daypartAt(now, timeZone)} name={context?.name ?? null} avatarUrl={context?.avatarUrl ?? null} streak={streak.kind === "ok" ? streak.data.current : 0} />
        <div className="dashboard-grid">
          <div className="dashboard-row dashboard-row--lead">
            <Suspense fallback={<CardSkeleton area="continue" />}><ContinueLearningCard context={context} /></Suspense>
            <Suspense fallback={<CardSkeleton area="mission" />}><MissionPanel promise={missionPromise} /></Suspense>
          </div>
          <div className="dashboard-row dashboard-row--three">
            <Suspense fallback={<CardSkeleton area="journey" />}><JourneyPanel /></Suspense>
          </div>
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
