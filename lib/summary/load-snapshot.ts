import "server-only";
import { staticAnalyses } from "@/lib/analysis/line-analysis";
import type { StaticLineAnalysis } from "@/lib/analysis/types";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import { fetchByIdChunks } from "@/lib/data/query-pagination";
import { getTranscript } from "@/lib/data/transcripts";
import { requireUser, selectVideoById } from "@/lib/data/videos";
import { createClient } from "@/lib/supabase/server";
import { buildLessonSnapshot, lessonEvidenceSchema, type LessonSnapshot, type SavedCard, type SummaryLine } from "./snapshot";

export interface LoadedSummary {
  userId: string;
  video: {
    id: string;
    youtubeVideoId: string;
    title: string;
    thumbnailUrl: string | null;
    jlptLevel: string | null;
    durationSeconds: number | null;
  };
  lines: SummaryLine[];
  hasTranscript: boolean;
  completed: boolean;
  snapshot: LessonSnapshot;
  saved: SavedCard[];
}

export async function loadLessonSummary(
  videoId: string,
): Promise<{ ok: true; data: LoadedSummary } | { ok: false; status: 401 | 404 }> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const video = await selectVideoById(supabase, videoId);
  if (!video) return { ok: false, status: 404 };
  const transcript = await getTranscript(videoId);
  if (!transcript.ok) return { ok: false, status: transcript.status };

  const lines: SummaryLine[] = (transcript.data?.lines ?? [])
    .filter((line) => line.text_jp.trim() !== "")
    .map((line, index) => ({
      id: line.id,
      index,
      textJp: line.text_jp,
      translation: line.text_translation,
      startTime: line.start_time,
      endTime: line.end_time,
    }));

  const { data, error } = await supabase.rpc("lesson_summary_evidence", {
    p_video: videoId,
    p_mastery: MASTERY_THRESHOLD,
  });
  if (error) throw error;
  const evidence = lessonEvidenceSchema.parse(data);

  const analyses = lines.length > 0
    ? await staticAnalyses(supabase, lines.map((line) => ({ id: line.id, textJp: line.textJp })), undefined, "full")
    : new Map<string, StaticLineAnalysis>();
  const grammarSpans = new Map<string, string[]>();
  const grammarIds = new Set<string>();
  for (const line of lines) {
    const matches = analyses.get(line.id)?.grammar ?? [];
    if (matches.length > 0) {
      grammarSpans.set(line.id, matches.map((match) => line.textJp.slice(match.span.start, match.span.end)));
    }
    for (const match of matches) grammarIds.add(match.grammarPointId);
  }
  const savedGrammar = await fetchByIdChunks([...grammarIds], async (chunk) => {
    const { data: rows, error: grammarError } = await supabase
      .from("user_grammar_progress")
      .select("grammar_id")
      .eq("user_id", user.id)
      .in("grammar_id", chunk);
    if (grammarError) throw grammarError;
    return (rows ?? []) as { grammar_id: string }[];
  });

  return {
    ok: true,
    data: {
      userId: user.id,
      video: {
        id: video.id,
        youtubeVideoId: video.youtube_video_id,
        title: video.title,
        thumbnailUrl: video.thumbnail_url,
        jlptLevel: video.jlpt_level_estimate,
        durationSeconds: video.duration_seconds,
      },
      lines,
      hasTranscript: evidence.hasTranscript,
      completed: evidence.completed,
      snapshot: buildLessonSnapshot(evidence, lines, grammarSpans, savedGrammar.length),
      saved: evidence.saved,
    },
  };
}
