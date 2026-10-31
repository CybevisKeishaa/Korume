"use client";

import { useTranslations } from "@/lib/i18n";
import { usePlaybackTime } from "./playback-position-store";
import { BeatMarkers } from "./beat-markers";
import { usePlaybackController, usePositionStore } from "./workspace-context";

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The listen-only dock's time label, `m:ss / m:ss` (Ruling T1). */
export function PlaybackClock({ duration }: { duration: number | null }) {
  const time = usePlaybackTime(usePositionStore());
  const max = duration ?? Math.max(time, 0);
  return <span data-testid="playback-clock" className="shrink-0 text-caption tabular-nums text-muted-foreground">{clock(Math.min(time, max))} / {clock(max)}</span>;
}

/**
 * The only seek control (spec §7.3): a native range input, so the arrow keys, Home/End and drag are the
 * browser's own. Beat markers sit underneath as one non-interactive SVG. `neutral` steps the fill down to the
 * muted foreground (5.4:1 on the card), so the dock's "Nghe lại câu" is its only accent (Ruling T1).
 */
export function ProgressBar({ duration, neutral = false }: { duration: number | null; neutral?: boolean }) {
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
        className={`relative w-full cursor-pointer ${neutral ? "accent-muted-foreground" : "accent-primary"}`}
      />
    </div>
  );
}
