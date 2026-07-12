/**
 * Minimal typed contract for the YouTube IFrame Player API (`window.YT`),
 * plus a module-singleton loader for the API script.
 *
 * Kept intentionally narrow: only the surface `youtube-player.tsx` uses.
 * Mirrors the fake installed by `test/youtube-stub.ts` so tests exercise the
 * same shape as production. NEVER downloads/proxies video — this only talks
 * to the official iframe embed (CLAUDE.md §2).
 */

export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YtPlayerStateValue = (typeof YT_PLAYER_STATE)[keyof typeof YT_PLAYER_STATE];

/** The subset of the real `YT.Player` instance surface this app calls. */
export interface YtPlayerLike {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YtPlayerStateValue;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

export interface YtPlayerEvents {
  onReady?: (event: { target: YtPlayerLike }) => void;
  onStateChange?: (event: { target: YtPlayerLike; data: YtPlayerStateValue }) => void;
  onError?: (event: { target: YtPlayerLike; data: number }) => void;
}

export interface YtPlayerConfig {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, unknown>;
  events?: YtPlayerEvents;
}

interface YtNamespace {
  Player: new (elementId: string | HTMLElement, config: YtPlayerConfig) => YtPlayerLike;
  PlayerState: typeof YT_PLAYER_STATE;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReadyPromise: Promise<void> | null = null;

/**
 * Loads the YouTube IFrame Player API script exactly once per page load
 * (module-level singleton), resolving once `window.YT.Player` exists. If
 * `window.YT` is already present — the real script already loaded, or a test
 * installed `installYouTubeStub()` — resolves immediately without touching
 * the DOM.
 */
export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };

    const alreadyRequested = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (alreadyRequested) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return apiReadyPromise;
}
