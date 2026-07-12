import { describe, expect, it, afterEach } from "vitest";
import {
  installYouTubeStub,
  YT_PLAYER_STATE,
  type YouTubeStubHandle,
} from "./youtube-stub";

describe("installYouTubeStub", () => {
  let handle: YouTubeStubHandle | undefined;

  afterEach(() => {
    handle?.restore();
    handle = undefined;
  });

  it("installs window.YT.Player and fires onReady by default", () => {
    handle = installYouTubeStub();
    let readyTarget: unknown;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- window.YT is untyped by design (matches the real global YouTube injects).
    const YT = (window as any).YT;
    const player = new YT.Player("player-el", {
      videoId: "abc123",
      events: {
        onReady: (e: { target: unknown }) => {
          readyTarget = e.target;
        },
      },
    });

    expect(handle.players).toEqual([player]);
    expect(readyTarget).toBe(player);
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.UNSTARTED);
    expect(player.getDuration()).toBe(120);
  });

  it("supports seekTo/getCurrentTime clamped to duration, and play/pause state changes", () => {
    handle = installYouTubeStub({ duration: 30 });
    let lastState: number | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above.
    const YT = (window as any).YT;
    const player = new YT.Player("player-el", {
      events: {
        onStateChange: (e: { data: number }) => {
          lastState = e.data;
        },
      },
    });

    player.seekTo(999);
    expect(player.getCurrentTime()).toBe(30);

    player.playVideo();
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);
    expect(lastState).toBe(YT_PLAYER_STATE.PLAYING);

    player.pauseVideo();
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED);
    expect(lastState).toBe(YT_PLAYER_STATE.PAUSED);
  });

  it("autoReady: false defers onReady until triggerReady() is called", () => {
    handle = installYouTubeStub({ autoReady: false });
    let readyFired = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above.
    const YT = (window as any).YT;
    const player = new YT.Player("player-el", {
      events: { onReady: () => (readyFired = true) },
    });

    expect(readyFired).toBe(false);
    player.triggerReady();
    expect(readyFired).toBe(true);
  });

  it("restore() removes window.YT", () => {
    handle = installYouTubeStub();
    handle.restore();
    expect((window as { YT?: unknown }).YT).toBeUndefined();
  });
});
