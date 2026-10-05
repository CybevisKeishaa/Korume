import "server-only";
import { staticAnalyses } from "@/lib/analysis/line-analysis";
import type { StaticLineAnalysis } from "@/lib/analysis/types";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import { fetchByIdChunks } from "@/lib/data/query-pagination";
import { getTranscript } from "@/lib/data/transcripts";
import { requireUser, selectVideoById } from "@/lib/data/videos";
import { createClient } from "@/lib/supabase/server";
import { buildLessonSnapshot, lessonEvidenceSchema, summaryLines, type LessonSnapshot, type SavedCard, type SummaryLine } from "./snapshot";

/** The signed-in learner and the client that proved it; callers rate-limit on it before any lesson load (m1). */
export interface SummaryAuth {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}

export async function authenticateSummary(): Promise<SummaryAuth | null> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  return user ? { supabase, userId: user.id } : null;
}

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
  /** The static line analyses the snapshot was built from; the lesson analysis key reuses them (m2). */
  analyses: Map<string, StaticLineAnalysis>;
  hasTranscript: boolean;
  completed: boolean;
  snapshot: LessonSnapshot;
  saved: SavedCard[];
}

export async function loadLessonSummary(
  videoId: string,
  signedIn?: SummaryAuth,
): Promise<{ ok: true; data: LoadedSummary } | { ok: false; status: 401 | 404 }> {
  const auth = signedIn ?? await authenticateSummary();
  if (!auth) return { ok: false, status: 401 };
  const { supabase, userId } = auth;
  const video = await selectVideoById(supabase, videoId);
  if (!video) return { ok: false, status: 404 };
  const transcript = await getTranscript(videoId);
  if (!transcript.ok) return { ok: false, status: transcript.status };

  const lines = summaryLines(transcript.data?.lines);

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
      .eq("user_id", userId)
      .in("grammar_id", chunk);
    if (grammarError) throw grammarError;
    return (rows ?? []) as { grammar_id: string }[];
  });

  return {
    ok: true,
    data: {
      userId,
      video: {
        id: video.id,
        youtubeVideoId: video.youtube_video_id,
        title: video.title,
        thumbnailUrl: video.thumbnail_url,
        jlptLevel: video.jlpt_level_estimate,
        durationSeconds: video.duration_seconds,
      },
      lines,
      analyses,
      hasTranscript: evidence.hasTranscript,
      completed: evidence.completed,
      snapshot: buildLessonSnapshot(evidence, lines, grammarSpans, savedGrammar.length),
      saved: evidence.saved,
    },
  };
}
