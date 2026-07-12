"use client";

import { forwardRef, useEffect, useImperativeHandle, useId, useRef } from "react";
import {
  loadYouTubeIframeApi,
  YT_PLAYER_STATE,
  type YtPlayerLike,
  type YtPlayerStateValue,
} from "./load-youtube-api";

export { YT_PLAYER_STATE };
export type { YtPlayerStateValue };

/**
 * Imperative handle exposed by `YouTubePlayer`. This is the seam later
 * shadowing tasks (A9 mic-sync recording, A10 dictation, B2 pitch playback
 * controls, B4 sentence-mining clip capture) build on instead of reaching
 * into player internals — extend this interface, don't bypass it.
 */
export interface YouTubePlayerHandle {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YtPlayerStateValue;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  play(): void;
  pause(): void;
  setPlaybackRate(rate: number): void;
}

export interface YouTubePlayerProps {
  /** Bare YouTube video id (`videos.youtube_video_id`) — never a URL. */
  videoId: string;
  className?: string;
  /** Fires once the underlying `YT.Player` is constructed and ready for commands. */
  onReady?: () => void;
  /** Fires on every native player state transition (see `YT_PLAYER_STATE`). */
  onStateChange?: (state: YtPlayerStateValue) => void;
  /**
   * Fires on the native `onError` event (e.g. region-locked, deleted, or
   * embedding-disabled video — oEmbed can still succeed, so this is the only
   * signal). See the YouTube IFrame API docs for error codes. Consumers
   * should surface an accessible fallback state instead of leaving a black
   * player with no feedback.
   */
  onError?: (code: number) => void;
  /** Fires on a fixed interval while the player is PLAYING, with the current time in seconds. */
  onTick?: (currentTime: number) => void;
  /** Interval in ms for `onTick` while playing. Defaults to 250. */
  tickIntervalMs?: number;
}

/**
 * Thin wrapper around the official YouTube IFrame Player API. Never
 * downloads or proxies video (CLAUDE.md §2) — this only instantiates the
 * embed and relays its official player commands/events.
 */
export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, className, onReady, onStateChange, onError, onTick, tickIntervalMs = 250 },
    ref,
  ) {
    const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
    const hostRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<YtPlayerLike | null>(null);

    // Latest-callback refs so the setup effect only depends on `videoId` /
    // `tickIntervalMs` and doesn't tear down + recreate the player whenever a
    // parent passes a fresh inline callback.
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onStateChangeRef = useRef(onStateChange);
    onStateChangeRef.current = onStateChange;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const onTickRef = useRef(onTick);
    onTickRef.current = onTick;

    useImperativeHandle(
      ref,
      () => ({
        getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
        getDuration: () => playerRef.current?.getDuration() ?? 0,
        getPlayerState: () => playerRef.current?.getPlayerState() ?? YT_PLAYER_STATE.UNSTARTED,
        seekTo: (seconds: number, allowSeekAhead = true) =>
          playerRef.current?.seekTo(seconds, allowSeekAhead),
        play: () => playerRef.current?.playVideo(),
        pause: () => playerRef.current?.pauseVideo(),
        setPlaybackRate: (rate: number) => playerRef.current?.setPlaybackRate(rate),
      }),
      [],
    );

    useEffect(() => {
      let cancelled = false;
      let tickHandle: ReturnType<typeof setInterval> | null = null;

      function stopTicking() {
        if (tickHandle !== null) {
          clearInterval(tickHandle);
          tickHandle = null;
        }
      }

      function startTicking() {
        stopTicking();
        tickHandle = setInterval(() => {
          const player = playerRef.current;
          if (player) onTickRef.current?.(player.getCurrentTime());
        }, tickIntervalMs);
      }

      loadYouTubeIframeApi().then(() => {
        if (cancelled || !hostRef.current || !window.YT) return;
        // `onReady` can fire synchronously inside the `new YT.Player(...)`
        // call (the test stub does this) — read the player off the event's
        // `target`, not a closure over the `const` below, which would still
        // be in its temporal dead zone at that point.
        new window.YT.Player(hostRef.current, {
          videoId,
          playerVars: { rel: 0 },
          events: {
            onReady: (event) => {
              playerRef.current = event.target;
              onReadyRef.current?.();
            },
            onStateChange: (event) => {
              onStateChangeRef.current?.(event.data);
              if (event.data === YT_PLAYER_STATE.PLAYING) startTicking();
              else stopTicking();
            },
            onError: (event) => {
              stopTicking();
              onErrorRef.current?.(event.data);
            },
          },
        });
      });

      return () => {
        cancelled = true;
        stopTicking();
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [videoId, tickIntervalMs]);

    return (
      <div
        ref={hostRef}
        id={`yt-player-${reactId}`}
        className={className}
        data-testid="youtube-player-host"
      />
    );
  },
);
YouTubePlayer.displayName = "YouTubePlayer";
