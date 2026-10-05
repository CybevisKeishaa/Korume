"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { loadYouTubeIframeApi, YT_PLAYER_STATE, type YtPlayerLike } from "@/components/video-player/load-youtube-api";
import { useTranslations } from "@/lib/i18n";
import type { LineRef } from "@/lib/summary/analysis/view";

type ClipControl = { play(source: LineRef, opener: HTMLElement): void };
const ClipContext = createContext<ClipControl | null>(null);

export function useClipPlayer(): ClipControl {
  const control = useContext(ClipContext);
  if (!control) throw new Error("ClipPlayerProvider is required");
  return control;
}

/** One YouTube iframe for all word cards; it exists only while the dock is open. */
export function ClipPlayerProvider({ youtubeVideoId, children }: { youtubeVideoId: string; children: ReactNode }) {
  const t = useTranslations("shadowing.lessonSummary.clip");
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YtPlayerLike | null>(null);
  /** The real API exposes seekTo/playVideo only after onReady; until then a play only updates `current`. */
  const ready = useRef(false);
  const current = useRef<LineRef | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);
  const alive = useRef(true);

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const tick = useCallback(() => {
    const target = current.current;
    const instance = player.current;
    if (!target || !instance) return;
    const end = target.endTime ?? target.startTime + 6;
    if (instance.getCurrentTime() >= end) {
      frame.current = null;
      instance.pauseVideo();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback((source: LineRef, button: HTMLElement) => {
    current.current = source;
    opener.current = button;
    if (player.current && ready.current) {
      cancelFrame();
      player.current.seekTo(source.startTime, true);
      player.current.playVideo();
      // Already PLAYING fires no state change, so the stop check is restarted here, not only in onStateChange.
      if (frame.current === null) frame.current = requestAnimationFrame(tick);
    } else {
      setOpen(true);
    }
  }, [cancelFrame, tick]);

  const close = useCallback(() => {
    cancelFrame();
    player.current?.pauseVideo();
    player.current?.destroy();
    player.current = null;
    ready.current = false;
    setPlaying(false);
    setOpen(false);
    opener.current?.focus();
  }, [cancelFrame]);

  useEffect(() => {
    if (!open || !host.current) return;
    let active = true;
    void loadYouTubeIframeApi().then(() => {
      const namespace = window.YT;
      if (!active || !alive.current || !host.current || player.current || !namespace?.Player) return;
      player.current = new namespace.Player(host.current, {
        videoId: youtubeVideoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: ({ target }) => {
            if (!active || !alive.current) return;
            player.current = target;
            ready.current = true;
            if (current.current) {
              target.seekTo(current.current.startTime, true);
              target.playVideo();
            }
          },
          onStateChange: ({ data }) => {
            if (!active || !alive.current) return;
            const isPlaying = data === YT_PLAYER_STATE.PLAYING;
            setPlaying(isPlaying);
            cancelFrame();
            if (isPlaying) frame.current = requestAnimationFrame(tick);
          },
        },
      });
    });
    return () => { active = false; };
  }, [open, youtubeVideoId, cancelFrame, tick]);

  useEffect(() => {
    alive.current = true; // StrictMode re-runs this effect after its cleanup
    return () => {
      alive.current = false;
      cancelFrame();
      player.current?.destroy();
      player.current = null;
      ready.current = false;
    };
  }, [cancelFrame]);

  return (
    <ClipContext.Provider value={{ play }}>
      {children}
      {open && (
        <aside role="region" aria-label={t("region")} className="fixed inset-x-0 bottom-0 z-50 max-h-[40vh] overflow-auto rounded-lg border border-border bg-background p-sm shadow-raised lg:inset-x-auto lg:bottom-md lg:right-md lg:w-80">
          <div className="mb-xs flex items-center justify-between gap-xs">
            <span role="status" aria-live="polite" className="text-caption">{playing ? t("playing") : t("paused")}</span>
            <Button variant="ghost" size="sm" onClick={close} aria-label={t("close")}>×</Button>
          </div>
          <div className="relative aspect-video w-full overflow-hidden rounded-md">
            <div ref={host} className="absolute inset-0" />
          </div>
        </aside>
      )}
    </ClipContext.Provider>
  );
}

export function HearInLessonButton({ source, label }: { source: LineRef; label: string }) {
  const { play } = useClipPlayer();
  return (
    <button type="button" className="inline-flex items-center gap-xs rounded-md text-caption font-semibold text-primary-strong underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={(event) => play(source, event.currentTarget)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></svg>
      {label}
    </button>
  );
}
