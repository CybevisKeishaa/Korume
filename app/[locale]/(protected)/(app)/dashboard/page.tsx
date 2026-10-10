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
import { KorumeCard } from "@/components/dashboard/korume-card";
import { WeaknessCard } from "@/components/dashboard/weakness-card";
import { WeeklyCard } from "@/components/dashboard/weekly-card";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { AchievementCard } from "@/components/dashboard/achievement-card";
import { getContinueLearning } from "@/lib/data/dashboard/facts";
import { getCurriculumJourney } from "@/lib/data/dashboard/journey";
import { getDailyMission } from "@/lib/data/dashboard/mission";
import { getActivityFact, getWeaknessFacts, getWeeklyFacts } from "@/lib/data/dashboard/facts";
import { getAchievementSnapshot } from "@/lib/data/dashboard/achievements";
import { resolveDashboardCue } from "@/lib/companion/dashboard-cues";
import { WEEKLY_WINDOWS } from "@/lib/dashboard/weekly";
import { buildActivityGrid } from "@/lib/dashboard/activity";
import { studyDate } from "@/lib/time/study-day";

const unavailableWeeklyBars = Array.from({ length: WEEKLY_WINDOWS }, (_, index) => ({ index, unavailable: true as const }));

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

async function KorumePanel({ context, missionPromise }: { context: Awaited<ReturnType<typeof getDashboardContext>>; missionPromise: ReturnType<typeof getDailyMission> }) {
  if (!context) return null;
  const [mission, weekly, weakness] = await Promise.all([missionPromise, loadCard("weekly_cue", () => getWeeklyFacts(context)), loadCard("weakness_cue", () => getWeaknessFacts(context))]);
  const cue = weekly.kind === "ok" && weakness.kind === "ok" ? resolveDashboardCue({ missionCompletedToday: mission.kind === "ok" && mission.data.rewarded, weeklyDeltas: { listening: weekly.data.listeningDelta, pronunciation: weekly.data.pronunciationDelta }, weakest: weakness.data }) : null;
  return <KorumeCard enabled={context.companionEnabled} cue={cue} />;
}

async function WeaknessPanel({ context }: { context: NonNullable<Awaited<ReturnType<typeof getDashboardContext>>> | null }) {
  const state = context ? await loadCard("weakness", () => getWeaknessFacts(context)) : { kind: "unavailable" } as const;
  return <WeaknessCard rows={state.kind === "ok" ? state.data : []} error={state.kind === "error"} />;
}

async function WeeklyPanel({ context }: { context: NonNullable<Awaited<ReturnType<typeof getDashboardContext>>> | null }) {
  const state = context ? await loadCard("weekly", () => getWeeklyFacts(context)) : { kind: "unavailable" } as const;
  return <WeeklyCard error={state.kind === "error"} fact={state.kind === "ok" ? state.data : { bars: unavailableWeeklyBars, hoursW0: 0, trackedSinceDate: null, vocabularyMastered: 0, listeningDelta: null, pronunciationDelta: null }} />;
}

async function ActivityPanel({ context, streak }: { context: NonNullable<Awaited<ReturnType<typeof getDashboardContext>>> | null; streak: number }) {
  const state = context ? await loadCard("activity", () => getActivityFact(context)) : { kind: "unavailable" } as const;
  const unavailable = buildActivityGrid({ today: context?.today ?? studyDate(new Date(), "UTC"), counts: new Map(), scheduleDays: context?.scheduleDays ?? [], firstTrackedDate: "9999-12-31" });
  return <ActivityCard error={state.kind === "error"} cells={state.kind === "ok" ? state.data : unavailable} streak={streak} />;
}

async function AchievementPanel({ context }: { context: NonNullable<Awaited<ReturnType<typeof getDashboardContext>>> | null }) {
  const state = context ? await loadCard("achievements", () => getAchievementSnapshot(context)) : { kind: "unavailable" } as const;
  return <AchievementCard error={state.kind === "error"} snapshot={state.kind === "ok" ? state.data : { earned: [], inProgress: [] }} today={context?.today ?? ""} />;
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
            <Suspense fallback={<CardSkeleton area="korume" />}><KorumePanel context={context} missionPromise={missionPromise} /></Suspense>
            <Suspense fallback={<CardSkeleton area="journey" />}><JourneyPanel /></Suspense>
            <Suspense fallback={<CardSkeleton area="weakness" />}><WeaknessPanel context={context} /></Suspense>
          </div>
          <div className="dashboard-row dashboard-row--trend"><Suspense fallback={<CardSkeleton area="weekly" />}><WeeklyPanel context={context} /></Suspense><Suspense fallback={<CardSkeleton area="activity" />}><ActivityPanel context={context} streak={streak.kind === "ok" ? streak.data.current : 0} /></Suspense></div>
          <div className="dashboard-row dashboard-row--achievements"><Suspense fallback={<CardSkeleton area="achievements" />}><AchievementPanel context={context} /></Suspense></div>
          <div className="dashboard-row dashboard-row--quick">
            <Suspense fallback={<CardSkeleton area="quick" />}><QuickAccessCard /></Suspense>
          </div>
        </div>
      </div>
    </Container>
  );
}
