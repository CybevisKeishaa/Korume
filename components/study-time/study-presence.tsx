"use client";

import type { StudySurface } from "@/lib/study-time/surfaces";
import { useStudyPresence } from "./use-study-presence";

/** Client island for server rendered study pages. */
export function StudyPresence(props: { surface: StudySurface; contextId: string | null; mediaPlaying?: boolean; enabled?: boolean }) {
  useStudyPresence(props);
  return null;
}
