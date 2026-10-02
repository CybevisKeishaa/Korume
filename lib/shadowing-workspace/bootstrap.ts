import type { SentenceMarkDto } from "@/lib/data/sentence-marks";
import type { UserPreferences } from "@/lib/preferences/options";
import type { JlptLevel } from "@/lib/video-types";
import type { WorkspaceLine } from "./types";

export interface WorkspaceBootstrap {
  userId: string;
  video: {
    id: string;
    youtubeVideoId: string;
    title: string;
    channelTitle: string | null;
    durationSeconds: number | null;
    jlptLevel: JlptLevel | null;
  };
  transcript: { id: string; lines: WorkspaceLine[] } | null;
  masteryMap: Record<string, number>;
  preferences: UserPreferences;
  resume: { position: number; lastWatchedAt: string | null } | null;
  lessonBookmarked: boolean;
  marks: SentenceMarkDto[];
}
