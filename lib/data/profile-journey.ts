import type { MilestoneKind, ProfileView } from "@/lib/profile/view";

const KINDS: ReadonlySet<string> = new Set<MilestoneKind>([
  "first_activity", "first_video_completed", "first_mastered_word", "first_certification_passed",
  "badge_earned", "first_meeting", "first_shadow", "jlpt_passed", "pinned_line",
]);

interface JourneyRow { kind: string; at: string; label: string | null }

/** profile_journey rows to view rows. A kind this build does not know is dropped, never rendered blank. */
export function mapJourney(rows: readonly JourneyRow[] | null): ProfileView["journey"] {
  return (rows ?? [])
    .filter((row) => KINDS.has(row.kind))
    .map((row) => ({ kind: row.kind as MilestoneKind, at: new Date(row.at).toISOString(), label: row.label ?? null }));
}
