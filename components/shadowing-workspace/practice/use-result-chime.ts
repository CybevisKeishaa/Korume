"use client";

import { useCallback, useRef } from "react";
import { playResultChime } from "@/lib/sound/result-chime";
import { scoreBand } from "@/lib/summary/thresholds";
import { usePreferences } from "../workspace-context";

type ChimeMode = Parameters<typeof scoreBand>[0];

/**
 * Plays a scored result's chime unless the learner turned Result sounds off (Settings, `feedback_sounds`). Read
 * through a ref so a stable callback still sees a switch flipped mid-lesson. Show answer is not a result: no chime.
 */
export function useResultChime(): (mode: ChimeMode, score: number) => void {
  const { preferences } = usePreferences();
  const on = useRef(preferences.feedbackSounds);
  on.current = preferences.feedbackSounds;
  return useCallback((mode, score) => {
    if (on.current) playResultChime(scoreBand(mode, score));
  }, []);
}
