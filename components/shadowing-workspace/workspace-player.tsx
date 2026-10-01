"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { YouTubePlayer } from "@/components/video-player/youtube-player";
import { usePlayerWiring } from "./playback-root";
import {
  FullscreenGlyph, MutedGlyph, NextGlyph, PauseGlyph, PlayGlyph, PreviousGlyph, RewindFiveGlyph,
  SubtitlesGlyph, SubtitlesOffGlyph, VolumeGlyph,
} from "./player-glyphs";
import { ProgressBar } from "./progress-bar";
import { SentenceLoopControl } from "./sentence-loop-control";
import { SpeedControl } from "./speed-control";
import { useCurrentSentence, useLesson, usePlaybackController, useSession, useStartPosition } from "./workspace-context";

const ICON_BUTTON = "flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:text-primary-strong";

/**
 * The workspace player (Figma `105:3593`, spec §7.3): a real 16:9 YouTube embed (not the frame's crop),
 * the current-line subtitle overlay, a centre play button while paused, then the control bar.
 */
export function WorkspacePlayer() {
  const t = useTranslations("shadowing");
  const { video, lines } = useLesson();
  const controller = usePlaybackController();
  const { adapterRef, onReady, onStateChange, playing } = usePlayerWiring();
  const startPosition = useStartPosition();
  const { index } = useCurrentSentence();
  const [, dispatch] = useSession();
  const [subtitles, setSubtitles] = useState(true);
  const [muted, setMuted] = useState(false);
  const [playerError, setPlayerError] = useState<number | null>(null);
  const subtitle = index === null ? null : lines[index]?.textJp ?? null;

  return (
    <section aria-label={t("workspace.player.label")} className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Width = min(column, (viewport height − the reserve) × 16/9): at 1280×529 Live Sentence stays in view (§7.1). */}
      <div className="bg-black">
      <div className="relative mx-auto aspect-video w-[min(100%,calc((100dvh-var(--workspace-video-reserve))*16/9))]">
        <YouTubePlayer
          ref={adapterRef}
          videoId={video.youtubeVideoId}
          className="absolute inset-0 size-full"
          initialPosition={startPosition}
          onReady={onReady}
          onStateChange={onStateChange}
          onError={setPlayerError}
        />
        {subtitles && subtitle !== null && (
          <p lang="ja" className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/85 font-jp px-md py-sm text-center text-body text-foreground" data-testid="workspace-subtitle">
            {subtitle}
          </p>
        )}
        {!playing && playerError === null && (
          <button
            type="button"
            onClick={() => controller.play()}
            aria-label={t("workspace.player.play")}
            className="absolute left-1/2 top-1/2 flex h-control-lg aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised"
          >
            <PlayGlyph className="size-icon-sm" />
          </button>
        )}
        {playerError !== null && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-xs bg-background/90 p-md text-center">
            <p className="text-body font-medium text-foreground">{t("playerError.title")}</p>
            <p className="text-caption text-muted-foreground">{t("playerError.body")}</p>
          </div>
        )}
      </div>
      </div>

      <div className="px-sm pb-xs pt-2xs">
        <ProgressBar duration={video.durationSeconds} />
        <div className="flex items-center justify-between gap-sm">
          <div className="flex items-center gap-2xs">
            <button type="button" className={ICON_BUTTON} aria-label={t("workspace.player.previous")} onClick={() => controller.previousSentence()}>
              <PreviousGlyph className="size-icon-sm" />
            </button>
            <button type="button" className={ICON_BUTTON} aria-label={t(playing ? "workspace.player.pause" : "workspace.player.play")} onClick={() => controller.togglePlay()}>
              {playing ? <PauseGlyph className="size-icon-sm" /> : <PlayGlyph className="size-icon-sm" />}
            </button>
            <button type="button" className={ICON_BUTTON} aria-label={t("workspace.player.next")} onClick={() => controller.nextSentence()}>
              <NextGlyph className="size-icon-sm" />
            </button>
            <button type="button" className={ICON_BUTTON} aria-label={t("workspace.player.rewind5")} onClick={() => controller.rewind(5)}>
              <RewindFiveGlyph className="size-icon-sm" />
            </button>
          </div>
          <div className="flex items-center gap-2xs">
            <SentenceLoopControl />
            <SpeedControl />
            <button
              type="button"
              className={ICON_BUTTON}
              aria-pressed={muted}
              aria-label={t(muted ? "workspace.player.unmute" : "workspace.player.mute")}
              // The IFrame API's isMuted() answers from a cache the iframe updates later; decide from the state before toggling.
              onClick={() => { const next = !controller.isMuted(); controller.toggleMute(); setMuted(next); }}
            >
              {muted ? <MutedGlyph className="size-icon-sm" /> : <VolumeGlyph className="size-icon-sm" />}
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-pressed={subtitles}
              aria-label={t(subtitles ? "workspace.player.subtitlesHide" : "workspace.player.subtitlesShow")}
              onClick={() => setSubtitles((shown) => !shown)}
            >
              {subtitles ? <SubtitlesGlyph className="size-icon-sm" /> : <SubtitlesOffGlyph className="size-icon-sm" />}
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={t("workspace.player.fullscreen")}
              onClick={() => dispatch({ type: "set-fullscreen", target: "player" })}
            >
              <FullscreenGlyph className="size-icon-sm" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
