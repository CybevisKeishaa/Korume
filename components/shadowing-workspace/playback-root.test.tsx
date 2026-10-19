import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { PlaybackRoot, usePlayerWiring } from "./playback-root";
import { WorkspaceProviders, usePlaybackController, usePositionStore } from "./workspace-context";
import type { PlayerAdapter } from "./player-adapter";

const route = vi.hoisted(() => ({ pathname: "/shadowing/video-1" }));
vi.mock("@/lib/i18n/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./use-progress-persistence", () => ({ useProgressPersistence: () => ({ flush: vi.fn() }) }));
const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Lesson", channelTitle: null, durationSeconds: 9, jlptLevel: "N3" },
  transcript: { id: "transcript-1", lines: [
    { id: "a", index: 0, startTime: 0, endTime: 3, textJp: "A", textTranslation: null, furigana: null },
    { id: "b", index: 1, startTime: 3, endTime: 6, textJp: "B", textTranslation: null, furigana: null },
  ] },
  masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked: false, marks: [], notes: { lessonNote: null, sentenceNotes: [] },
};

function setup() {
  const wrapper = ({ children }: { children: React.ReactNode }) => <WorkspaceProviders bootstrap={bootstrap} initialPosition={4}><PlaybackRoot userId="user-1" initialSyncedServerAt={null}>{children}</PlaybackRoot></WorkspaceProviders>;
  const hook = renderHook(() => ({ wiring: usePlayerWiring(), controller: usePlaybackController(), store: usePositionStore() }), { wrapper });
  const adapter: PlayerAdapter = { play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(), getCurrentTime: () => 4, getDuration: () => 9, getPlayerState: () => 2, setPlaybackRate: vi.fn(), getAvailablePlaybackRates: () => [1], mute: vi.fn(), unMute: vi.fn(), isMuted: () => false };
  Object.assign(hook.result.current.wiring.adapterRef, { current: adapter });
  return { ...hook, adapter };
}

describe("PlaybackRoot practice wiring", () => {
  it("uses the route flag immediately and keeps the controller identity across modes", () => {
    route.pathname = "/shadowing/video-1/pronunciation";
    const { result, adapter, rerender } = setup();
    const controller = result.current.controller;
    act(() => controller.play());
    expect(adapter.seekTo).toHaveBeenLastCalledWith(3, true);
    route.pathname = "/shadowing/video-1";
    rerender();
    expect(result.current.controller).toBe(controller);
    vi.mocked(adapter.seekTo).mockClear();
    act(() => controller.play());
    expect(adapter.seekTo).not.toHaveBeenCalled();
  });

  it("mirrors loop cancellation into the shared wiring synchronously", () => {
    route.pathname = "/shadowing/video-1/listening";
    const { result } = setup();
    act(() => result.current.wiring.setLoop({ enabled: true, count: 0 }));
    expect(result.current.controller.loopConfig().enabled).toBe(true);
    expect(result.current.wiring.loop.enabled).toBe(true);
    act(() => result.current.controller.seekToSentence(0));
    expect(result.current.controller.loopConfig().enabled).toBe(false);
    expect(result.current.wiring.loop).toEqual(result.current.controller.loopConfig());
  });
});
