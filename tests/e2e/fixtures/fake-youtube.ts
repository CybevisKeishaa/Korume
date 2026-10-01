import type { Page } from "@playwright/test";

/** What a spec reads back from the page (`window.__fakeYt`). */
export interface FakeYtSnapshot {
  mounts: number;
  time: number;
  state: number;
  rate: number;
  muted: boolean;
  /** Every `seekTo` target the app sent to the current player, in order. */
  seeks: number[];
}

export const FAKE_YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/**
 * Installs a fake `window.YT` BEFORE the app loads (spec §8): the app's loader returns early when
 * `window.YT.Player` exists (`components/video-player/load-youtube-api.ts`), so no production code path
 * exists only for tests. The fake implements every `YtPlayerLike` member the workspace calls, renders
 * `[data-testid="fake-yt"]` into the host, fires `onReady` on a microtask, and keeps a clock the spec
 * drives: `advance(seconds)` moves time only while PLAYING, at the current rate, in small steps with an
 * animation frame between them — the app reads `getCurrentTime()` once per frame (T0 ruling), so every
 * step is observed and a boundary is never jumped.
 *
 * Like the real player, `pauseVideo()` before the first play leaves the state UNSTARTED (T0 measured
 * `-1 → 3 → -1`), and `seekTo` never changes the state.
 */
export async function installFakeYouTube(page: Page, { duration = 95 }: { duration?: number } = {}): Promise<void> {
  await page.addInitScript(({ duration: total }) => {
    const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
    type Events = { onReady?(event: unknown): void; onStateChange?(event: unknown): void };
    const control: { mounts: number; current: FakePlayer | null } = { mounts: 0, current: null };
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    class FakePlayer {
      time = 0;
      rate = 1;
      muted = false;
      playerState = STATE.UNSTARTED;
      seeks: number[] = [];
      readonly element = document.createElement("div");
      readonly config: { events?: Events };
      constructor(host: HTMLElement | string, config: { events?: Events }) {
        this.config = config;
        control.mounts += 1;
        control.current = this;
        const target = typeof host === "string" ? document.getElementById(host) : host;
        this.element.dataset.testid = "fake-yt";
        this.element.style.cssText = "position:absolute;inset:0;background:#111";
        target?.appendChild(this.element);
        queueMicrotask(() => this.config.events?.onReady?.({ target: this }));
      }
      emit(state: number) {
        this.playerState = state;
        setTimeout(() => this.config.events?.onStateChange?.({ target: this, data: state }), 0);
      }
      getCurrentTime() { return this.time; }
      getDuration() { return total; }
      getPlayerState() { return this.playerState; }
      seekTo(seconds: number) { this.seeks.push(seconds); this.time = Math.max(0, Math.min(seconds, total)); }
      playVideo() { if (this.playerState !== STATE.PLAYING) this.emit(STATE.PLAYING); }
      pauseVideo() { if (this.playerState === STATE.PLAYING || this.playerState === STATE.BUFFERING) this.emit(STATE.PAUSED); }
      setPlaybackRate(rate: number) { this.rate = rate; }
      getPlaybackRate() { return this.rate; }
      getAvailablePlaybackRates() { return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]; }
      mute() { this.muted = true; }
      unMute() { this.muted = false; }
      isMuted() { return this.muted; }
      destroy() { this.element.remove(); if (control.current === this) control.current = null; }
    }

    Object.assign(window, {
      YT: { Player: FakePlayer, PlayerState: STATE },
      __fakeYt: {
        snapshot() {
          const player = control.current;
          return { mounts: control.mounts, time: player?.time ?? 0, state: player?.playerState ?? STATE.UNSTARTED, rate: player?.rate ?? 1, muted: player?.muted ?? false, seeks: [...(player?.seeks ?? [])] };
        },
        setTime(seconds: number) { if (control.current) control.current.time = seconds; },
        async advance(seconds: number, step = 0.05) {
          for (let left = seconds; left > 1e-9; left -= step) {
            const player = control.current;
            if (player?.playerState === STATE.PLAYING) {
              player.time = Math.min(total, player.time + Math.min(step, left) * player.rate);
              if (player.time >= total) player.emit(STATE.ENDED);
            }
            await frame();
          }
          await frame();
        },
      },
    });
  }, { duration });
}

export async function fakeYt(page: Page): Promise<FakeYtSnapshot> {
  return page.evaluate(() => (window as unknown as { __fakeYt: { snapshot(): FakeYtSnapshot } }).__fakeYt.snapshot());
}

export async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => (window as unknown as { __fakeYt: { advance(s: number): Promise<void> } }).__fakeYt.advance(s), seconds);
}
