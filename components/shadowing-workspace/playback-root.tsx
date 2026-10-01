"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { YT_PLAYER_STATE, type YtPlayerStateValue } from "@/components/video-player/youtube-player";
import type { LoopConfig } from "@/lib/shadowing-workspace/loop-machine";
import type { PlayerAdapter } from "./player-adapter";
import { usePlaybackControllerState } from "./use-playback-controller";
import { useProgressPersistence } from "./use-progress-persistence";
import { ControllerProvider, useLesson, usePositionStore, usePreferences, useStartPosition } from "./workspace-context";

interface PlayerWiring {
  adapterRef: React.RefObject<PlayerAdapter>;
  onReady(): void;
  onStateChange(state: YtPlayerStateValue): void;
  /** Re-renders the controls when the player starts or stops (the controller's own state lives in refs). */
  playing: boolean;
}

const PlayerWiringContext = createContext<PlayerWiring | null>(null);

export function usePlayerWiring(): PlayerWiring {
  const wiring = useContext(PlayerWiringContext);
  if (wiring === null) throw new Error("usePlayerWiring must be used within PlaybackRoot");
  return wiring;
}

/**
 * Owns the one playback controller and the progress persistence for the workspace (Task 5), so the player
 * (left column) and the transcript (right column) drive the same instance.
 */
export function PlaybackRoot({ userId, initialSyncedServerAt, children }: {
  userId: string;
  initialSyncedServerAt: string | null;
  children: ReactNode;
}) {
  const { lines, video } = useLesson();
  const positionStore = usePositionStore();
  const startPosition = useStartPosition();
  const { preferences } = usePreferences();
  const adapterRef = useRef<PlayerAdapter>(null);
  const [playing, setPlaying] = useState(false);
  // The preference is the starting loop of this session; the Sentence pill changes it for the session only.
  const initialLoop = useRef<LoopConfig>({
    enabled: preferences.playbackLoopCount !== 1,
    count: preferences.playbackLoopCount,
    autoPause: preferences.playbackAutoPause,
  }).current;
  const flushRef = useRef<(reason: "pause" | "ended") => void>(() => undefined);
  const onSentence = useCallback(() => undefined, []);

  const { controller, onStateChange, onReady } = usePlaybackControllerState({
    adapterRef,
    lines,
    duration: video.durationSeconds,
    positionStore,
    onSentence,
    onFlush: (reason) => flushRef.current(reason),
    initialLoop,
    initialRate: preferences.playbackDefaultRate,
  });
  const { flush } = useProgressPersistence({
    userId,
    videoId: video.id,
    positionStore,
    isPlaying: () => controller.isPlaying(),
    initialSyncedServerAt,
    startPosition,
  });
  flushRef.current = flush;

  const handleStateChange = useCallback((state: YtPlayerStateValue) => {
    onStateChange(state);
    setPlaying(state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING);
  }, [onStateChange]);

  const wiring = useMemo(() => ({ adapterRef, onReady, onStateChange: handleStateChange, playing }), [handleStateChange, onReady, playing]);
  return (
    <ControllerProvider controller={controller}>
      <PlayerWiringContext.Provider value={wiring}>{children}</PlayerWiringContext.Provider>
    </ControllerProvider>
  );
}
