"use client";

import { useTranslations } from "@/lib/i18n";
import { usePlaybackTime } from "./playback-position-store";
import { BeatMarkers } from "./beat-markers";
import { usePlaybackController, usePositionStore } from "./workspace-context";

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The only seek control (spec §7.3): a native range input, so the arrow keys, Home/End and drag are the
 * browser's own. Beat markers sit underneath as one non-interactive SVG.
 */
export function ProgressBar({ duration }: { duration: number | null }) {
  const t = useTranslations("shadowing");
  const controller = usePlaybackController();
  const time = usePlaybackTime(usePositionStore());
  const max = duration ?? Math.max(time, 0);
  return (
    <div className="relative flex h-control-sm items-center">
      <BeatMarkers duration={duration} />
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(time, max)}
        onChange={(event) => controller.seekTo(Number(event.currentTarget.value))}
        aria-label={t("workspace.player.seek")}
        aria-valuetext={t("workspace.player.seekValue", { current: clock(time), total: clock(max) })}
        className="relative w-full cursor-pointer accent-primary"
      />
    </div>
  );
}
