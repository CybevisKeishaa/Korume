import "server-only";
import { cache } from "react";
import { buildJourney, type JourneyLevelRow, type JourneyView } from "@/lib/dashboard/journey";
import type { JlptLevel } from "@/lib/conversation-types";
import { createClient } from "@/lib/supabase/server";

interface CurriculumJourneyRow {
  level: JlptLevel;
  core_total: number;
  core_completed: number;
  next_video_id: string | null;
  next_title: string | null;
  next_position: number | null;
  plus_total: number;
  plus_accessible: number;
}

interface CurriculumMembershipRow {
  collection_title: string;
  lesson_position: number;
}

function toJourneyLevelRow(row: CurriculumJourneyRow): JourneyLevelRow {
  return {
    level: row.level,
    coreTotal: row.core_total,
    coreCompleted: row.core_completed,
    plusTotal: row.plus_total,
    plusAccessible: row.plus_accessible,
    next: row.next_video_id && row.next_title && row.next_position !== null
      ? { videoId: row.next_video_id, title: row.next_title, position: row.next_position }
      : null,
  };
}

export const getCurriculumJourney = cache(async (): Promise<JourneyView> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("curriculum_journey");
  if (error) throw error;
  return buildJourney(((data as CurriculumJourneyRow[] | null) ?? []).map(toJourneyLevelRow));
});

export async function getCurriculumPlacement(videoId: string): Promise<{ title: string; position: number } | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("curriculum_membership", { p_video_id: videoId });
  if (error) throw error;
  const row = (data as CurriculumMembershipRow[] | null)?.[0];
  return row ? { title: row.collection_title, position: row.lesson_position } : null;
}
