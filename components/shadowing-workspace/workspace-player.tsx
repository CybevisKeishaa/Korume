"use client";

import { forwardRef, useEffect, useRef, useState, type PointerEvent } from "react";
import { useTranslations } from "@/lib/i18n";
import { YouTubePlayer } from "@/components/video-player/youtube-player";
import { usePlayerWiring } from "./playback-root";
import {
  FullscreenGlyph, MutedGlyph, NextGlyph, PauseGlyph, PlayGlyph, PreviousGlyph, RewindFiveGlyph,
  SubtitlesGlyph, SubtitlesOffGlyph, VolumeGlyph,
} from "./player-glyphs";
import { ProgressBar } from "./progress-bar";
import { POPOVER_ID as LOOP_POPOVER, SentenceLoopControl } from "./sentence-loop-control";
import { POPOVER_ID as SPEED_POPOVER, SpeedControl } from "./speed-control";
import { useCurrentSentence, useLesson, usePlaybackController, useSession, useStartPosition } from "./workspace-context";

const IDLE_HIDE_MS = 2500;

const ICON_BUTTON = "flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:text-primary-strong";
// Secondary controls drop out of the Full Transcript PiP (`data-pip` on the pane) so its bar keeps one row.
const PIP_HIDDEN_BUTTON = `${ICON_BUTTON} group-data-[pip]/pip:hidden`;

/**
 * The workspace player (Figma `105:3593`, spec §7.3): a real 16:9 YouTube embed (not the frame's crop),
 * a centre play button while paused, and the current-line subtitle above our control bar, both laid over the
 * video's bottom edge. Ours shows while paused, while the pointer moves (hidden after IDLE_HIDE_MS still), while
 * hovered, while one of its popovers is open, or with keyboard focus. A transparent surface over the iframe takes
 * the pointer, because the parent page never sees `:hover` or moves over a cross-origin iframe; a click on it
 * toggles play, a touch tap on a hidden bar only shows the bar (YouTube's own rule).
 *
 * YouTube's own bar is left ON: with `controls: 0` the embed refused an unmuted `playVideo()` from this page in a
 * fresh Chrome profile (live Ep.729 gate, 2026-10-02: state stayed -1; the same build with controls on played). The
 * surface keeps the pointer from ever reaching it, so it only shows while paused, under our bar.
 */
export const WorkspacePlayer = forwardRef<HTMLElement, { onFullscreen(trigger: HTMLElement): void; fullscreenAvailable: boolean }>(function WorkspacePlayer({ onFullscreen, fullscreenAvailable }, ref) {
  const t = useTranslations("shadowing");
  const { video, lines } = useLesson();
  const controller = usePlaybackController();
  const { adapterRef, onReady, onStateChange, playing } = usePlayerWiring();
  const startPosition = useStartPosition();
  const { index } = useCurrentSentence();
  const [subtitles, setSubtitles] = useState(true);
  const [muted, setMuted] = useState(false);
  const [playerError, setPlayerError] = useState<number | null>(null);
  const subtitle = index === null ? null : lines[index]?.textJp ?? null;
  const [pointerActive, setPointerActive] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(idleTimer.current), []);
  const wake = () => {
    setPointerActive(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setPointerActive(false), IDLE_HIDE_MS);
  };
  const sleep = (event: PointerEvent) => {
    if (event.pointerType === "touch") return; // a lifted finger "leaves"; the idle timer hides the bar instead
    clearTimeout(idleTimer.current);
    setPointerActive(false);
  };
  const [session] = useSession();
  // Only the bar's own popovers hold it open; Reading Settings and the other header popovers do not.
  const barShown = !playing || pointerActive || session.openPopover === SPEED_POPOVER || session.openPopover === LOOP_POPOVER;
  const pressType = useRef("");
  const onSurfaceClick = () => {
    // Space must reach play/pause, not the transcript row that held focus before this pointer press.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (pressType.current === "touch" && !barShown) return wake();
    controller.togglePlay();
  };

  return (
    <section ref={ref} aria-label={t("workspace.player.label")} data-workspace-player className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Width = min(column, (viewport height − the reserve) × 16/9): at 1280×529 Live Sentence stays in view (§7.1). */}
      <div className="bg-black">
      <div data-workspace-player-video onPointerMove={wake} onPointerLeave={sleep} className="relative mx-auto aspect-video w-[min(100%,calc((100dvh-var(--workspace-video-reserve)-var(--workspace-drawer-height))*16/9))]">
        <YouTubePlayer
          ref={adapterRef}
          videoId={video.youtubeVideoId}
          className="absolute inset-0 size-full"
          initialPosition={startPosition}
          onReady={onReady}
          onStateChange={onStateChange}
          onError={setPlayerError}
        />
        <div aria-hidden data-testid="workspace-player-surface" className="absolute inset-0 group-data-[pip]/pip:cursor-grab" onPointerDown={(event) => { pressType.current = event.pointerType; }} onClick={onSurfaceClick} />
        {!playing && playerError === null && (
          <button
            type="button"
            onClick={() => controller.play()}
            aria-label={t("workspace.player.play")}
            className="group-data-[pip]/pip:hidden absolute left-1/2 top-1/2 z-10 flex h-control-lg aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised"
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
        {/* A failed embed keeps only its alert: a bar of dead controls would sit on top of it. */}
        {playerError === null && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col">
          {subtitles && subtitle !== null && (
            <p lang="ja" className="reading-foreground reading-jp-body bg-[hsl(var(--reading-surface)/0.85)] px-md py-2xs text-center font-jp" data-testid="workspace-subtitle">
              {subtitle}
            </p>
          )}
          {/* Hidden = zero rows tall (not just transparent), so the subtitle sits on the video's edge until the bar shows. */}
          <div
            data-shown={barShown ? "" : undefined}
            // A tap sends no pointermove: each tap on the bar restarts the idle timer, or it collapses mid-use.
            onPointerDown={(event) => { if (event.pointerType === "touch") wake(); }}
            className="pointer-events-auto grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] has-[:focus-visible]:grid-rows-[1fr] has-[:focus-visible]:opacity-100 hover:grid-rows-[1fr] hover:opacity-100 data-[shown]:grid-rows-[1fr] data-[shown]:opacity-100"
          >
          <div data-workspace-player-controls className="min-h-0 overflow-hidden bg-gradient-to-t from-black/90 via-black/75 to-transparent px-sm">
            <div aria-hidden className="h-xs" />
            <ProgressBar duration={video.durationSeconds} />
            <div className="flex flex-wrap items-center justify-between gap-x-sm pb-xs">
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
                <div className="contents group-data-[pip]/pip:hidden"><SentenceLoopControl /></div>
                <SpeedControl />
                <button
                  type="button"
                  className={PIP_HIDDEN_BUTTON}
                  aria-pressed={muted}
                  aria-label={t(muted ? "workspace.player.unmute" : "workspace.player.mute")}
                  // The IFrame API's isMuted() answers from a cache the iframe updates later; decide from the state before toggling.
                  onClick={() => { const next = !controller.isMuted(); controller.toggleMute(); setMuted(next); }}
                >
                  {muted ? <MutedGlyph className="size-icon-sm" /> : <VolumeGlyph className="size-icon-sm" />}
                </button>
                <button
                  type="button"
                  className={PIP_HIDDEN_BUTTON}
                  aria-pressed={subtitles}
                  aria-label={t(subtitles ? "workspace.player.subtitlesHide" : "workspace.player.subtitlesShow")}
                  onClick={() => setSubtitles((shown) => !shown)}
                >
                  {subtitles ? <SubtitlesGlyph className="size-icon-sm" /> : <SubtitlesOffGlyph className="size-icon-sm" />}
                </button>
                {fullscreenAvailable && <button
                  type="button"
                  className={PIP_HIDDEN_BUTTON}
                  aria-label={t("workspace.player.fullscreen")}
                  onClick={(event) => onFullscreen(event.currentTarget)}
                >
                  <FullscreenGlyph className="size-icon-sm" />
                </button>}
              </div>
            </div>
          </div>
          </div>
        </div>}
      </div>
      </div>
    </section>
  );
});
