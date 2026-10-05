import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser, selectVideoById } from "@/lib/data/videos";
import { getRecommendations } from "@/lib/data/recommendations";
import type { SummaryLine } from "./snapshot";

export interface NextLesson {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  jlptLevel: string | null;
  href: string;
  reason: "path" | "recommended";
}

export interface SummaryNavigation {
  nextLesson: NextLesson | null;
  replayHref: string;
  resumeHref: string;
}

export function lineHrefs(
  videoId: string,
  lines: SummaryLine[],
  resumePosition: number | null,
): Pick<SummaryNavigation, "replayHref" | "resumeHref"> {
  const base = `/shadowing/${videoId}`;
  const first = lines[0];
  if (!first) return { replayHref: base, resumeHref: base };

  const replayHref = `${base}?line=${first.id}`;
  if (resumePosition === null) return { replayHref, resumeHref: replayHref };

  const resumeLine = [...lines].reverse().find((line) => line.startTime <= resumePosition) ?? first;
  return { replayHref, resumeHref: `${base}?line=${resumeLine.id}` };
}

async function pathNext(supabase: ReturnType<typeof createClient>, videoId: string): Promise<string | null> {
  const { data: memberships, error } = await supabase
    .from("lesson_collections")
    .select("collection_id, position, collections!inner(kind)")
    .eq("lesson_id", videoId)
    .eq("collections.kind", "path")
    .gt("position", 0)
    .order("collection_id", { ascending: true });
  if (error) throw error;

  for (const membership of (memberships ?? []) as { collection_id: string; position: number }[]) {
    const { data: next, error: nextError } = await supabase
      .from("lesson_collections")
      .select("lesson_id")
      .eq("collection_id", membership.collection_id)
      .gt("position", membership.position)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextError) throw nextError;
    if (next) return (next as { lesson_id: string }).lesson_id;
  }
  return null;
}

export async function getSummaryNavigation(videoId: string, lines: SummaryLine[]): Promise<SummaryNavigation> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  let resumePosition: number | null = null;
  if (user) {
    const { data, error } = await supabase
      .from("user_video_progress")
      .select("last_watched_position")
      .eq("user_id", user.id)
      .eq("video_id", videoId)
      .maybeSingle();
    if (error) throw error;
    if (data) resumePosition = Number((data as { last_watched_position: number | string }).last_watched_position);
  }
  const hrefs = lineHrefs(videoId, lines, resumePosition);

  const nextId = await pathNext(supabase, videoId);
  if (nextId) {
    const video = await selectVideoById(supabase, nextId);
    if (video) {
      return {
        ...hrefs,
        nextLesson: {
          videoId: video.id,
          title: video.title,
          thumbnailUrl: video.thumbnail_url,
          jlptLevel: video.jlpt_level_estimate,
          href: `/shadowing/${video.id}`,
          reason: "path",
        },
      };
    }
  }

  const recommendations = await getRecommendations({ limit: 12 });
  const pick = recommendations.ok ? recommendations.data.find((item) => item.videoId !== videoId) : undefined;
  return {
    ...hrefs,
    nextLesson: pick
      ? {
        videoId: pick.videoId,
        title: pick.title,
        thumbnailUrl: pick.thumbnailUrl,
        jlptLevel: pick.jlptLevelEstimate,
        href: `/shadowing/${pick.videoId}`,
        reason: "recommended",
      }
      : null,
  };
}
