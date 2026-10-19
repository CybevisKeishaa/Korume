import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PracticeModeId } from "@/lib/shadowing-workspace/learning-modes";
import type { LoopConfig } from "@/lib/shadowing-workspace/loop-machine";
import { PlayerWiringContext } from "./playback-root";
import { usePracticePlayback } from "./use-practice-playback";

const original: LoopConfig = { enabled: true, count: 3, autoPause: false };

describe("usePracticePlayback", () => {
  it("saves once across practice modes and restores the previous Shadowing loop", () => {
    let loop = original;
    const setLoop = vi.fn((config: Partial<LoopConfig>) => { loop = { ...loop, ...config }; });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlayerWiringContext.Provider value={{ adapterRef: { current: null }, onReady: vi.fn(), onStateChange: vi.fn(), playing: false, loop, setLoop, toggleLoop: vi.fn(), rate: 1, setRate: vi.fn() }}>{children}</PlayerWiringContext.Provider>
    );
    const hook = renderHook(({ mode }: { mode: PracticeModeId }) => usePracticePlayback(mode), { wrapper, initialProps: { mode: "shadowing" } });
    expect(setLoop).not.toHaveBeenCalled();
    hook.rerender({ mode: "pronunciation" });
    expect(setLoop).toHaveBeenLastCalledWith({ enabled: false, autoPause: true });
    act(() => { loop = { enabled: true, count: 0, autoPause: true }; });
    hook.rerender({ mode: "listening" });
    hook.rerender({ mode: "shadowing" });
    expect(setLoop).toHaveBeenLastCalledWith(original);
    const calls = setLoop.mock.calls.length;
    hook.rerender({ mode: "shadowing" });
    expect(setLoop).toHaveBeenCalledTimes(calls);
    act(() => { loop = { enabled: false, count: 1, autoPause: false }; });
    hook.rerender({ mode: "pronunciation" });
    hook.rerender({ mode: "shadowing" });
    expect(setLoop).toHaveBeenLastCalledWith({ enabled: false, count: 1, autoPause: false });
  });
});
