import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoopConfig } from "@/lib/shadowing-workspace/loop-machine";
import { locateSentence } from "@/lib/shadowing-workspace/sentence-lookup";
import { createPlaybackPositionStore } from "./playback-position-store";
import { usePlaybackControllerState } from "./use-playback-controller";
import { installYouTubeStub, YT_PLAYER_STATE, type FakeYtPlayer, type YouTubeStubHandle } from "@/test/youtube-stub";
import type { PlayerAdapter } from "./player-adapter";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";

const lines: WorkspaceLine[] = [
  { id: "a", index: 0, startTime: 0, endTime: 3, textJp: "A", textTranslation: null, furigana: null },
  { id: "b", index: 1, startTime: 3, endTime: 6, textJp: "B", textTranslation: null, furigana: null },
  { id: "c", index: 2, startTime: 6, endTime: 9, textJp: "C", textTranslation: null, furigana: null },
];
const gapLines: WorkspaceLine[] = [
  { id: "a", index: 0, startTime: 0, endTime: 3, textJp: "A", textTranslation: null, furigana: null },
  { id: "b", index: 1, startTime: 3.5, endTime: 6, textJp: "B", textTranslation: null, furigana: null },
  { id: "c", index: 2, startTime: 6, endTime: 9, textJp: "C", textTranslation: null, furigana: null },
];

function adapterFor(player: FakeYtPlayer): PlayerAdapter {
  return {
    getCurrentTime: () => player.getCurrentTime(), getDuration: () => player.getDuration(), getPlayerState: () => player.getPlayerState(),
    seekTo: (seconds, allowSeekAhead) => player.seekTo(seconds, allowSeekAhead), play: () => player.playVideo(), pause: () => player.pauseVideo(),
    setPlaybackRate: (rate) => player.setPlaybackRate(rate), getAvailablePlaybackRates: () => player.getAvailablePlaybackRates(),
    mute: () => player.mute(), unMute: () => player.unMute(), isMuted: () => player.isMuted(),
  };
}

describe("usePlaybackControllerState", () => {
  let yt: YouTubeStubHandle;
  let player: FakeYtPlayer;

  beforeEach(() => {
    yt = installYouTubeStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the test stub installs this global.
    player = new (window as any).YT.Player("player");
  });

  afterEach(() => { yt.restore(); vi.useRealTimers(); });

  function setup(loop: LoopConfig = { enabled: false, count: 1, autoPause: false }, configuredLines = lines, adapter = adapterFor(player), onFlush = vi.fn()) {
    const positionStore = createPlaybackPositionStore(0);
    const onSentence = vi.fn();
    const adapterRef = { current: adapter } as React.RefObject<PlayerAdapter>;
    const hook = renderHook(() => usePlaybackControllerState({ adapterRef, lines: configuredLines, duration: 9, positionStore, onSentence, initialLoop: loop, initialRate: 1, onFlush }));
    return { ...hook, positionStore, onSentence, onFlush };
  }

  it("publishes a sentence once for the spoken-state flip in a gap", () => {
    const { result, onSentence } = setup(undefined, gapLines);
    act(() => { result.current.onTick(2.9); result.current.onTick(3); result.current.onTick(3.1); result.current.onTick(3.5); });
    expect(onSentence.mock.calls.map(([position]) => position)).toEqual([
      { index: 0, isSpoken: true }, { index: 0, isSpoken: false }, { index: 1, isSpoken: true },
    ]);
  });

  it("replays twice then pauses a three-play loop, and next resets its cycle", () => {
    const { result } = setup({ enabled: true, count: 3, autoPause: true });
    const seek = vi.spyOn(player, "seekTo");
    const play = vi.spyOn(player, "playVideo");
    const pause = vi.spyOn(player, "pauseVideo");
    act(() => { result.current.onTick(3); result.current.onTick(5.9); result.current.onTick(6); result.current.onTick(3); result.current.onTick(5.9); result.current.onTick(6); result.current.onTick(3); result.current.onTick(5.9); result.current.onTick(6); });
    expect(seek).toHaveBeenCalledWith(3, true);
    expect(play).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledOnce();
    // ⏭ mid-cycle: C starts its own cycle (the first post-seek tick lands near the target, as real playback does).
    act(() => { result.current.controller.nextSentence(); result.current.onTick(6.1); result.current.onTick(8.9); result.current.onTick(9); });
    expect(seek).toHaveBeenLastCalledWith(6, true);
    expect(play).toHaveBeenCalledTimes(3);
  });

  it("does not replay a boundary skipped by a seek", () => {
    const { result } = setup({ enabled: true, count: 3, autoPause: false });
    const play = vi.spyOn(player, "playVideo");
    act(() => { result.current.onTick(3); result.current.onTick(8); result.current.controller.seekTo(8); result.current.onTick(8); });
    expect(play).not.toHaveBeenCalled();
  });

  it("auto pause keeps the store-derived sentence at the completed line through an extra tick", () => {
    const { result, positionStore, onSentence } = setup({ enabled: false, count: 1, autoPause: true });
    const pause = vi.spyOn(player, "pauseVideo");
    act(() => { result.current.onTick(3); result.current.onTick(5.9); result.current.onTick(6); result.current.onTick(6.01); });
    expect(pause).toHaveBeenCalledOnce();
    expect(locateSentence(lines, positionStore.get(), 9)).toEqual({ index: 1, isSpoken: true });
    expect(onSentence.mock.calls.at(-1)?.[0]).toEqual({ index: 1, isSpoken: true });
  });

  it("continues into the next sentence after an auto pause without replay", () => {
    const { result } = setup({ enabled: false, count: 1, autoPause: true });
    const play = vi.spyOn(player, "playVideo");
    act(() => { result.current.onTick(3); result.current.onTick(5.9); result.current.onTick(6); result.current.onStateChange(YT_PLAYER_STATE.PLAYING); result.current.onTick(6.1); });
    expect(play).not.toHaveBeenCalled();
  });

  it("uses one rAF loop while playing and cancels it on pause and unmount", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const { result, positionStore, unmount } = setup();
    player.setCurrentTimeForTest(2);
    act(() => { result.current.onStateChange(YT_PLAYER_STATE.PLAYING); result.current.onStateChange(YT_PLAYER_STATE.PLAYING); vi.advanceTimersByTime(20); });
    expect(positionStore.get()).toBe(2);
    act(() => result.current.onStateChange(YT_PLAYER_STATE.PAUSED));
    player.setCurrentTimeForTest(4);
    act(() => vi.advanceTimersByTime(20));
    expect(positionStore.get()).toBe(2);
    unmount();
  });

  it("uses the stored sentence for previous and next before the first tick", () => {
    const { result, positionStore } = setup();
    const seek = vi.spyOn(player, "seekTo");
    positionStore.set(4.6);
    act(() => result.current.controller.nextSentence());
    expect(seek).toHaveBeenLastCalledWith(6, true);
    act(() => result.current.controller.previousSentence());
    expect(seek).toHaveBeenLastCalledWith(3, true);
  });

  it("seeks to the prior line at its own 1.5-second threshold", () => {
    const { result } = setup();
    const seek = vi.spyOn(player, "seekTo");
    act(() => { result.current.onTick(3.8); result.current.controller.previousSentence(); });
    expect(seek).toHaveBeenLastCalledWith(0, true);
  });

  it("rewinds from two seconds to zero", () => {
    const { result } = setup();
    const seek = vi.spyOn(player, "seekTo");
    act(() => { result.current.onTick(2); result.current.controller.rewind(5); });
    expect(seek).toHaveBeenLastCalledWith(0, true);
  });

  it("clamps rates to the intersection with supported rates", () => {
    const available = vi.fn(() => [0.5, 0.75, 1]);
    const adapter: PlayerAdapter = { ...adapterFor(player), getAvailablePlaybackRates: available };
    const { result } = setup(undefined, lines, adapter);
    act(() => result.current.controller.setRate(0.8));
    expect(player.getPlaybackRate()).toBe(0.75);
    available.mockReturnValue([0.25, 1]);
    act(() => result.current.controller.setRate(0.25));
    expect(player.getPlaybackRate()).toBe(1);
    expect(result.current.controller.availableRates()).toEqual([1]);
  });

  it("sets the sentence position before play", () => {
    const positionStore = createPlaybackPositionStore(0);
    let positionWhenPlayed: number | null = null;
    const adapter: PlayerAdapter = { ...adapterFor(player), play: () => { positionWhenPlayed = positionStore.get(); player.playVideo(); } };
    const onSentence = vi.fn();
    const adapterRef = { current: adapter } as React.RefObject<PlayerAdapter>;
    const { result } = renderHook(() => usePlaybackControllerState({ adapterRef, lines, duration: 9, positionStore, onSentence, initialLoop: { enabled: false, count: 1, autoPause: false }, initialRate: 1 }));
    act(() => result.current.controller.seekToSentence(2, { play: true }));
    expect(positionStore.get()).toBe(6);
    expect(positionWhenPlayed).toBe(6);
  });

  it("flushes on real player pause and end", () => {
    const { result, onFlush } = setup();
    act(() => { result.current.onStateChange(YT_PLAYER_STATE.PAUSED); result.current.onStateChange(YT_PLAYER_STATE.ENDED); });
    expect(onFlush).toHaveBeenCalledWith("pause");
    expect(onFlush).toHaveBeenCalledWith("ended");
  });

  it("treats ended as the null-ended last sentence boundary", () => {
    const nullEndLines: WorkspaceLine[] = [...lines.slice(0, 2), { ...lines[2]!, endTime: null }];
    const { result } = setup({ enabled: true, count: 3, autoPause: false }, nullEndLines);
    const seek = vi.spyOn(player, "seekTo");
    const play = vi.spyOn(player, "playVideo");
    act(() => { result.current.onTick(6); result.current.onStateChange(YT_PLAYER_STATE.ENDED); });
    expect(seek).toHaveBeenLastCalledWith(6, true);
    expect(play).toHaveBeenCalledOnce();
  });

  it("does not decide the last sentence again at ENDED once a tick already crossed its end", () => {
    const outro: WorkspaceLine[] = [lines[0]!, lines[1]!, { ...lines[2]!, endTime: 8 }];
    const { result } = setup({ enabled: true, count: 3, autoPause: false }, outro);
    const seek = vi.spyOn(player, "seekTo");
    const play = vi.spyOn(player, "playVideo");
    act(() => {
      for (let play = 0; play < 3; play += 1) { result.current.onTick(6.1); result.current.onTick(7.9); result.current.onTick(8); }
      result.current.onTick(9.9);
    });
    expect(seek).toHaveBeenCalledTimes(2);
    act(() => result.current.onStateChange(YT_PLAYER_STATE.ENDED));
    expect(seek).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("ignores one stale post-seek clock read before the replay target arrives", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const readings = [3, 5.9, 6, 6.02, 3.01];
    const adapter: PlayerAdapter = { ...adapterFor(player), getCurrentTime: () => readings.shift() ?? 3.01 };
    const { result, onSentence } = setup({ enabled: true, count: 3, autoPause: false }, lines, adapter);
    act(() => { result.current.onStateChange(YT_PLAYER_STATE.PLAYING); vi.advanceTimersByTime(100); });
    expect(onSentence.mock.calls.map(([position]) => position)).toEqual([{ index: 1, isSpoken: true }]);
  });

  it("keeps the explicitly targeted duplicate-start line active after a controller seek", () => {
    const duplicateStarts: WorkspaceLine[] = [lines[0]!, { ...lines[1]!, id: "b-early" }, { ...lines[1]!, id: "b-late", index: 2 }, { ...lines[2]!, index: 3 }];
    const { result, onSentence } = setup(undefined, duplicateStarts);
    act(() => { result.current.controller.seekToSentence(1); result.current.onTick(3.1); });
    expect(onSentence.mock.calls.at(-1)?.[0]).toEqual({ index: 1, isSpoken: true });
  });

  it("pauses rather than plays while buffering", () => {
    const { result } = setup();
    const pause = vi.spyOn(player, "pauseVideo");
    player.triggerStateChange(YT_PLAYER_STATE.BUFFERING);
    act(() => result.current.controller.togglePlay());
    expect(pause).toHaveBeenCalledOnce();
  });
});
