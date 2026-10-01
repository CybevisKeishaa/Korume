import "server-only";
import { isLessonBookmarked } from "@/lib/data/lesson-bookmarks";
import { getMyPreferences } from "@/lib/data/preferences";
import { listMySentenceMarks } from "@/lib/data/sentence-marks";
import { getTranscript } from "@/lib/data/transcripts";
import { getMyLessonResume, getVideo, requireUser } from "@/lib/data/videos";
import { getVocabMasteryMap } from "@/lib/data/vocab-progress";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { canonicalLines } from "@/lib/shadowing-workspace/transcript-order";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { JlptLevel } from "@/lib/video-types";
import { createClient } from "@/lib/supabase/server";

export type LoadWorkspaceResult = { ok: true; data: WorkspaceBootstrap } | { ok: false; status: 401 | 404 };

const JLPT_LEVELS: readonly JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

function isJlptLevel(value: string): value is JlptLevel {
  return JLPT_LEVELS.some((level) => level === value);
}

function asJlptLevel(value: string | null): JlptLevel | null {
  return value !== null && isJlptLevel(value) ? value : null;
}

export async function loadWorkspaceBootstrap(videoId: string): Promise<LoadWorkspaceResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const [videoResult, transcriptResult, masteryMap, preferences, resume, lessonBookmarked] = await Promise.all([
    getVideo(videoId), getTranscript(videoId), getVocabMasteryMap(), getMyPreferences(), getMyLessonResume(videoId), isLessonBookmarked(videoId),
  ]);
  if (!videoResult.ok || !transcriptResult.ok) return { ok: false, status: 404 };

  const transcript = transcriptResult.data;
  const marks = transcript ? await listMySentenceMarks(transcript.id) : [];
  const video = videoResult.data;
  const selectedPreferences = preferences ?? DEFAULT_PREFERENCES;

  return {
    ok: true,
    data: {
      userId: user.id,
      video: {
        id: video.id, youtubeVideoId: video.youtube_video_id, title: video.title, channelTitle: video.channel_title,
        durationSeconds: video.duration_seconds, jlptLevel: asJlptLevel(video.jlpt_level_estimate),
      },
      transcript: transcript ? { id: transcript.id, lines: canonicalLines(transcript.lines) } : null,
      masteryMap: { ...masteryMap },
      preferences: { ...selectedPreferences, scheduleDays: [...selectedPreferences.scheduleDays] },
      resume: resume ? { ...resume } : null,
      lessonBookmarked,
      marks: marks.map((mark) => ({ ...mark })),
    },
  };
}
