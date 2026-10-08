import type { JlptLevel } from "@/lib/conversation-types";

/**
 * Authored JLPT curriculum (port-dashboard D2b). Each entry is a `youtube_video_id`; array order IS the lesson
 * order (position = index + 1). Changing this file is a content change: it is reviewed as such and applied with
 * `npm run content:sync-curriculum`, never by a migration. Empty is valid — the Dashboard then shows the real
 * "being prepared" state (D2c).
 */
export const JLPT_CURRICULUM: Readonly<Record<JlptLevel, readonly string[]>> = {
  N5: [],
  N4: [],
  N3: [],
  N2: [],
  N1: [],
};
