import { WEEKLY_SIGNIFICANT_POINTS } from "@/lib/dashboard/weekly";
import type { WeaknessFamily } from "@/lib/dashboard/weakness";

export type DashboardCueKey = "cue.missionCompleted" | "cue.weeklyImproved" | "cue.weakSkill";

export interface DashboardFacts {
  missionCompletedToday: boolean;
  weeklyDeltas: { listening: number | null; pronunciation: number | null };
  weakest: readonly { family: WeaknessFamily; metric: string; score: number; practiceHref: string | null }[];
}

export interface DashboardCue {
  key: DashboardCueKey;
  values: { skill?: string; points?: number; score?: number };
  practiceHref: string | null;
  viewWeakness: boolean;
}

export function resolveDashboardCue(facts: DashboardFacts): DashboardCue | null {
  if (facts.missionCompletedToday) {
    return { key: "cue.missionCompleted", values: {}, practiceHref: null, viewWeakness: false };
  }

  const improvement = (["listening", "pronunciation"] as const)
    .map((skill) => ({ skill, points: facts.weeklyDeltas[skill] }))
    .filter((candidate): candidate is { skill: "listening" | "pronunciation"; points: number } =>
      candidate.points !== null && candidate.points >= WEEKLY_SIGNIFICANT_POINTS,
    )
    .sort((left, right) => right.points - left.points)[0];
  if (improvement) {
    return { key: "cue.weeklyImproved", values: improvement, practiceHref: null, viewWeakness: false };
  }

  const weakness = facts.weakest.find((row) => row.practiceHref !== null);
  if (!weakness) return null;
  return {
    key: "cue.weakSkill",
    values: { skill: weakness.family === "pronunciation" ? weakness.metric : weakness.family, score: weakness.score },
    practiceHref: weakness.practiceHref,
    viewWeakness: true,
  };
}
