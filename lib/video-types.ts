/**
 * Client-safe shared types for the video / shadowing feature.
 *
 * These mirror the JSON shapes returned by the `/api/videos/*` routes (see the
 * data layer in `lib/data/videos.ts` + `lib/data/transcripts.ts`). Rows are
 * returned with their raw snake_case column names. This module has NO runtime
 * imports, so it is safe to import from client components — unlike `lib/japanese`
 * (server-only, pulls in the kuromoji tokenizer).
 */
export type { FuriganaSegment } from "@/lib/japanese/types";
import type { FuriganaSegment } from "@/lib/japanese/types";

export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type VideoStatus = "pending" | "approved";
export type TranscriptSource =
  | "youtube_caption"
  | "user_submitted"
  | "ai_generated";

export interface VideoRow {
  id: string;
  youtube_video_id: string;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  jlpt_level_estimate: JlptLevel | null;
  added_by_user_id: string | null;
  status: VideoStatus;
  created_at: string;
}

export interface TranscriptLineRow {
  id: string;
  start_time: number;
  end_time: number | null;
  text_jp: string;
  text_translation: string | null;
  furigana_json: FuriganaSegment[] | null;
}

export interface TranscriptWithLines {
  id: string;
  video_id: string;
  source: TranscriptSource;
  language: string;
  created_at: string;
  lines: TranscriptLineRow[];
}

export interface VideoProgressRow {
  user_id: string;
  video_id: string;
  last_watched_position: number;
  completed_at: string | null;
}

/**
 * word/reading -> srs_stage for vocab the current user has mastered.
 * Populated server-side by `lib/data/vocab-progress.ts::getVocabMasteryMap`
 * and consumed by the adaptive furigana feature (CLAUDE.md §5.4): a
 * segment's reading is hidden when its `text` is a key in this map.
 */
export type VocabMasteryMap = Record<string, number>;

/**
 * Furigana display mode for the shadowing transcript (CLAUDE.md §5.4):
 * "adaptive" shows a reading only for words the user hasn't mastered yet,
 * "all" always shows every reading, "off" hides every reading.
 */
export type FuriganaDisplayMode = "adaptive" | "all" | "off";
