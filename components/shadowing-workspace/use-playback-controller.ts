"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { PLAYBACK_RATE_OPTIONS } from "@/lib/preferences/options";
import { decideAtSentenceEnd, resetLoop, type LoopConfig, type LoopState } from "@/lib/shadowing-workspace/loop-machine";
import { effectiveEnd, locateSentence, nextTarget, previousTarget, sameSentencePosition, type SentencePosition } from "@/lib/shadowing-workspace/sentence-lookup";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { YT_PLAYER_STATE, type YtPlayerStateValue } from "@/components/video-player/youtube-player";
import type { PlaybackPositionStore } from "./playback-position-store";
import type { PlayerAdapter } from "./player-adapter";

export interface PlaybackController {
  play(): void;
  pause(): void;
  togglePlay(): void;
  isPlaying(): boolean;
  seekTo(seconds: number): void;
  seekToSentence(index: number, options?: { play?: boolean }): void;
  previousSentence(): void;
  nextSentence(): void;
  rewind(seconds: number): void;
  setRate(rate: number): void;
  availableRates(): number[];
  toggleMute(): void;
  isMuted(): boolean;
  setLoop(config: Partial<LoopConfig>): void;
  loopConfig(): LoopConfig;
}

export function usePlaybackControllerState(args: {
  adapterRef: React.RefObject<PlayerAdapter>;
  lines: WorkspaceLine[];
  duration: number | null;
  positionStore: PlaybackPositionStore;
  onSentence(position: SentencePosition): void;
  onFlush?(reason: "pause" | "ended"): void;
  initialLoop: LoopConfig;
  initialRate: number;
}): { controller: PlaybackController; onTick(time: number): void; onStateChange(state: YtPlayerStateValue): void; onReady(): void } {
  const argsRef = useRef(args);
  argsRef.current = args;
  const activeRef = useRef<SentencePosition>({ index: null, isSpoken: false });
  const loopConfigRef = useRef(args.initialLoop);
  const loopStateRef = useRef<LoopState>(resetLoop(activeRef.current.index));
  const lastTickTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedAtBoundaryRef = useRef(false);
  const seekGuardRef = useRef<{ target: number; expiresAt: number } | null>(null);
  const seekTargetIndexRef = useRef<number | null>(null);

  const publish = useCallback((position: SentencePosition, reset: boolean) => {
    const current = argsRef.current;
    if (!sameSentencePosition(activeRef.current, position)) current.onSentence(position);
    if (reset && activeRef.current.index !== position.index) loopStateRef.current = resetLoop(position.index);
    activeRef.current = position;
  }, []);

  const stopClock = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const positionAt = useCallback((time: number): SentencePosition => {
    const current = argsRef.current;
    const targetIndex = seekTargetIndexRef.current;
    if (targetIndex !== null) {
      const line = current.lines[targetIndex];
      if (line && time >= line.startTime && time < effectiveEnd(current.lines, targetIndex, current.duration)) {
        return { index: targetIndex, isSpoken: true };
      }
      seekTargetIndexRef.current = null;
    }
    return locateSentence(current.lines, time, current.duration);
  }, []);

  const seekTo = useCallback((seconds: number, explicitIndex?: number) => {
    const current = argsRef.current;
    const target = Math.max(0, Math.min(seconds, current.duration ?? Number.POSITIVE_INFINITY));
    // A deliberate seek (⏮/⏭/row/replay) leaves any Auto Pause hold behind it.
    pausedAtBoundaryRef.current = false;
    seekGuardRef.current = { target, expiresAt: Date.now() + 300 };
    seekTargetIndexRef.current = explicitIndex ?? null;
    current.positionStore.set(target);
    current.adapterRef.current?.seekTo(target, true);
    lastTickTimeRef.current = null;
    publish(positionAt(target), true);
  }, [positionAt, publish]);

  const onTick = useCallback((time: number) => {
    const current = argsRef.current;
    if (pausedAtBoundaryRef.current) return;
    const guard = seekGuardRef.current;
    if (guard) {
      if (Math.abs(time - guard.target) < 0.5 || Date.now() >= guard.expiresAt) seekGuardRef.current = null;
      else return;
    }
    current.positionStore.set(time);
    const before = activeRef.current;
    const end = before.index === null ? null : effectiveEnd(current.lines, before.index, current.duration);
    const last = lastTickTimeRef.current;
    const crossedBoundary = end !== null && last !== null && last < end && end <= time && time - last < 1.5;
    lastTickTimeRef.current = time;

    if (crossedBoundary && before.index !== null) {
      const result = decideAtSentenceEnd(loopConfigRef.current, loopStateRef.current);
      loopStateRef.current = result.next;
      if (result.decision.kind === "replay") {
        const line = current.lines[before.index];
        if (!line) return;
        seekTo(line.startTime, before.index);
        current.adapterRef.current?.play();
        return;
      }
      if (result.decision.kind === "pause") {
        pausedAtBoundaryRef.current = true;
        stopClock();
        current.positionStore.set(Math.min(time, end - 0.001));
        current.adapterRef.current?.pause();
        return;
      }
    }

    publish(positionAt(time), true);
  }, [positionAt, publish, seekTo, stopClock]);

  const startClock = useCallback(() => {
    stopClock();
    const tick = () => {
      const adapter = argsRef.current.adapterRef.current;
      if (!adapter) return;
      onTick(adapter.getCurrentTime());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onTick, stopClock]);
  useEffect(() => stopClock, [stopClock]);

  const onStateChange = useCallback((state: YtPlayerStateValue) => {
    if (state === YT_PLAYER_STATE.PLAYING) {
      pausedAtBoundaryRef.current = false;
      startClock();
      return;
    }
    stopClock();
    if (state === YT_PLAYER_STATE.PAUSED) argsRef.current.onFlush?.("pause");
    if (state !== YT_PLAYER_STATE.ENDED) return;
    argsRef.current.onFlush?.("ended");
    const current = argsRef.current;
    const active = activeRef.current.index === null ? positionAt(current.positionStore.get()) : activeRef.current;
    if (active.index === null) return;
    const playerDuration = current.adapterRef.current?.getDuration();
    const end = effectiveEnd(current.lines, active.index, typeof playerDuration === "number" && Number.isFinite(playerDuration) ? playerDuration : current.duration);
    // ENDED is a boundary only when no tick already crossed this sentence's end (a null-ended last line);
    // otherwise the loop/pause was decided there and deciding again would replay the last line forever.
    if (lastTickTimeRef.current !== null && lastTickTimeRef.current >= end) return;
    const result = decideAtSentenceEnd(loopConfigRef.current, loopStateRef.current);
    loopStateRef.current = result.next;
    const line = current.lines[active.index];
    if (!line) return;
    if (result.decision.kind === "replay") {
      seekTo(line.startTime, active.index);
      current.adapterRef.current?.play();
    } else if (result.decision.kind === "pause") {
      pausedAtBoundaryRef.current = true;
      current.positionStore.set(Math.min(current.positionStore.get(), end - 0.001));
      current.adapterRef.current?.pause();
    }
  }, [positionAt, seekTo, startClock, stopClock]);

  const controller = useMemo<PlaybackController>(() => ({
    play: () => argsRef.current.adapterRef.current?.play(),
    pause: () => argsRef.current.adapterRef.current?.pause(),
    togglePlay: () => {
      const adapter = argsRef.current.adapterRef.current;
      const state = adapter?.getPlayerState();
      if (state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING) adapter?.pause();
      else adapter?.play();
    },
    isPlaying: () => argsRef.current.adapterRef.current?.getPlayerState() === YT_PLAYER_STATE.PLAYING,
    seekTo,
    seekToSentence: (index, options) => {
      const line = argsRef.current.lines[index];
      if (!line) return;
      seekTo(line.startTime, index);
      if (options?.play) argsRef.current.adapterRef.current?.play();
    },
    previousSentence: () => {
      const current = argsRef.current;
      const activeIndex = activeRef.current.index ?? locateSentence(current.lines, current.positionStore.get(), current.duration).index;
      const target = previousTarget(current.lines, activeIndex, current.positionStore.get());
      const line = target === null ? undefined : current.lines[target];
      if (line) seekTo(line.startTime, target ?? undefined);
    },
    nextSentence: () => {
      const current = argsRef.current;
      const activeIndex = activeRef.current.index ?? locateSentence(current.lines, current.positionStore.get(), current.duration).index;
      const target = nextTarget(current.lines, activeIndex);
      const line = target === null ? undefined : current.lines[target];
      if (line) seekTo(line.startTime, target ?? undefined);
    },
    rewind: (seconds) => seekTo(argsRef.current.positionStore.get() - seconds),
    setRate: (rate) => {
      const available = PLAYBACK_RATE_OPTIONS.filter((option) => argsRef.current.adapterRef.current?.getAvailablePlaybackRates().includes(option));
      const nearest = available.reduce<number | null>((best, option) => best === null || Math.abs(option - rate) < Math.abs(best - rate) ? option : best, null);
      if (nearest !== null) argsRef.current.adapterRef.current?.setPlaybackRate(nearest);
    },
    availableRates: () => PLAYBACK_RATE_OPTIONS.filter((option) => argsRef.current.adapterRef.current?.getAvailablePlaybackRates().includes(option)),
    toggleMute: () => argsRef.current.adapterRef.current?.isMuted() ? argsRef.current.adapterRef.current.unMute() : argsRef.current.adapterRef.current?.mute(),
    isMuted: () => argsRef.current.adapterRef.current?.isMuted() ?? false,
    setLoop: (config) => { loopConfigRef.current = { ...loopConfigRef.current, ...config }; loopStateRef.current = resetLoop(activeRef.current.index); },
    loopConfig: () => loopConfigRef.current,
  }), [seekTo]);

  const onReady = useCallback(() => controller.setRate(argsRef.current.initialRate), [controller]);
  return { controller, onTick, onStateChange, onReady };
}
