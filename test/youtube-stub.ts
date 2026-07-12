/**
 * Fake YouTube IFrame Player API (`window.YT`) for jsdom/vitest.
 *
 * The real player loads an iframe and fires `onReady`/`onStateChange`
 * asynchronously off a network event we can't reproduce in jsdom. This stub
 * fires them synchronously and deterministically instead, and exposes
 * `trigger*` methods so a test drives state transitions explicitly rather
 * than racing timers (CLAUDE.md §7 — no flaky/nondeterministic tests).
 *
 * Typical usage:
 *
 *   let yt: YouTubeStubHandle;
 *   beforeEach(() => { yt = installYouTubeStub(); });
 *   afterEach(() => yt.restore());
 *
 *   // app code does: new window.YT.Player("player-el", { videoId, events })
 *   const player = yt.players[0];
 *   player.setCurrentTimeForTest(12.5);
 *   player.triggerStateChange(YT_PLAYER_STATE.PLAYING);
 */

/** Mirrors the real `YT.PlayerState` enum. */
export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YtPlayerStateValue =
  (typeof YT_PLAYER_STATE)[keyof typeof YT_PLAYER_STATE];

export interface YtReadyEvent {
  target: FakeYtPlayer;
}

export interface YtStateChangeEvent {
  target: FakeYtPlayer;
  data: YtPlayerStateValue;
}

export interface YtErrorEvent {
  target: FakeYtPlayer;
  data: number;
}

export interface YtPlayerConfig {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, unknown>;
  events?: {
    onReady?: (event: YtReadyEvent) => void;
    onStateChange?: (event: YtStateChangeEvent) => void;
    onError?: (event: YtErrorEvent) => void;
  };
}

export interface FakeYtPlayerOptions {
  /** Reported `getDuration()` in seconds. Defaults to 120. */
  duration?: number;
  /** Reported `getPlayerState()` before any trigger fires. Defaults to UNSTARTED. */
  initialState?: YtPlayerStateValue;
  /** If true (default), `onReady` fires synchronously at the end of construction. */
  autoReady?: boolean;
}

/**
 * Fake `YT.Player`. Implements the subset of the real API the shadowing
 * player needs (`getCurrentTime`, `getDuration`, `seekTo`, `playVideo`,
 * `pauseVideo`, `setPlaybackRate`, `getPlayerState`) plus `trigger*`/
 * `setCurrentTimeForTest` helpers that only exist on the fake, for tests to
 * drive playback state and elapsed time deterministically.
 */
export class FakeYtPlayer {
  readonly elementId: string;
  videoId: string;
  playerVars: Record<string, unknown>;

  private readonly events: NonNullable<YtPlayerConfig["events"]>;
  private currentTime = 0;
  private duration: number;
  private playbackRate = 1;
  private state: YtPlayerStateValue;
  private destroyed = false;

  constructor(
    elementId: string | HTMLElement,
    config: YtPlayerConfig = {},
    options: FakeYtPlayerOptions = {},
  ) {
    this.elementId =
      typeof elementId === "string" ? elementId : elementId.id;
    this.videoId = config.videoId ?? "";
    this.playerVars = config.playerVars ?? {};
    this.events = config.events ?? {};
    this.duration = options.duration ?? 120;
    this.state = options.initialState ?? YT_PLAYER_STATE.UNSTARTED;

    if (options.autoReady !== false) {
      this.triggerReady();
    }
  }

  // ---- test-driven triggers (not part of the real YT.Player API) ----

  /** Fires `events.onReady`. */
  triggerReady(): void {
    this.events.onReady?.({ target: this });
  }

  /** Sets `getPlayerState()` and fires `events.onStateChange`. */
  triggerStateChange(state: YtPlayerStateValue): void {
    this.state = state;
    this.events.onStateChange?.({ target: this, data: state });
  }

  /** Fires `events.onError` with the given YT error code (default 2 = invalid param). */
  triggerError(code = 2): void {
    this.events.onError?.({ target: this, data: code });
  }

  /** Moves the fake playhead without changing state or firing events. */
  setCurrentTimeForTest(seconds: number): void {
    this.currentTime = seconds;
  }

  // ---- real YT.Player API surface ----

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  seekTo(seconds: number, _allowSeekAhead = true): void {
    this.currentTime = Math.min(Math.max(seconds, 0), this.duration);
  }

  playVideo(): void {
    this.triggerStateChange(YT_PLAYER_STATE.PLAYING);
  }

  pauseVideo(): void {
    this.triggerStateChange(YT_PLAYER_STATE.PAUSED);
  }

  stopVideo(): void {
    this.currentTime = 0;
    this.triggerStateChange(YT_PLAYER_STATE.ENDED);
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  getAvailablePlaybackRates(): number[] {
    return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  }

  getPlayerState(): YtPlayerStateValue {
    return this.state;
  }

  destroy(): void {
    this.destroyed = true;
  }

  isDestroyedForTest(): boolean {
    return this.destroyed;
  }
}

export interface YouTubeStubHandle {
  /** Every `FakeYtPlayer` constructed since install, in construction order. */
  players: FakeYtPlayer[];
  /** Restores whatever `window.YT` was before this stub was installed. */
  restore(): void;
}

/**
 * Installs a fake `window.YT` (with `YT.Player` and `YT.PlayerState`).
 * @param defaultOptions applied to every player constructed while installed.
 */
export function installYouTubeStub(
  defaultOptions: FakeYtPlayerOptions = {},
): YouTubeStubHandle {
  const players: FakeYtPlayer[] = [];
  const windowWithYt = window as Window & { YT?: unknown };
  const originalYT = windowWithYt.YT;

  class TrackedFakeYtPlayer extends FakeYtPlayer {
    constructor(elementId: string | HTMLElement, config?: YtPlayerConfig) {
      super(elementId, config, defaultOptions);
      players.push(this);
    }
  }

  windowWithYt.YT = {
    Player: TrackedFakeYtPlayer,
    PlayerState: YT_PLAYER_STATE,
  };

  return {
    players,
    restore(): void {
      windowWithYt.YT = originalYT;
    },
  };
}
