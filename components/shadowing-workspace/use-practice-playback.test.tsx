import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PracticeModeId } from "@/lib/shadowing-workspace/learning-modes";
import type { LoopConfig } from "@/lib/shadowing-workspace/loop-machine";
import { PlayerWiringContext } from "./playback-root";
import type { PlaybackController } from "./use-playback-controller";
import { usePracticePlayback } from "./use-practice-playback";
import { ControllerProvider } from "./workspace-context";

const original: LoopConfig = { enabled: true, count: 3, autoPause: false };

function controllerStub(): PlaybackController {
  return {
    play: vi.fn(), pause: vi.fn(), togglePlay: vi.fn(), isPlaying: () => false, seekTo: vi.fn(), seekToSentence: vi.fn(),
    previousSentence: vi.fn(), nextSentence: vi.fn(), rewind: vi.fn(), setRate: vi.fn(), availableRates: () => [1],
    toggleMute: vi.fn(), isMuted: () => false, setLoop: vi.fn(), loopConfig: () => original, setLock: vi.fn(),
  };
}

function setup(initial: { mode: PracticeModeId; ready: boolean }) {
  let loop = original;
  const setLoop = vi.fn((config: Partial<LoopConfig>) => { loop = { ...loop, ...config }; });
  const controller = controllerStub();
  const wrapper = ({ children, ready }: { children: React.ReactNode; ready: boolean }) => (
    <ControllerProvider controller={controller}>
      <PlayerWiringContext.Provider value={{ adapterRef: { current: null }, onReady: vi.fn(), onStateChange: vi.fn(), ready, playing: false, loop, setLoop, toggleLoop: vi.fn(), rate: 1, setRate: vi.fn() }}>{children}</PlayerWiringContext.Provider>
    </ControllerProvider>
  );
  let currentReady = initial.ready;
  const hook = renderHook(({ mode }: { mode: PracticeModeId; ready: boolean }) => usePracticePlayback(mode), {
    wrapper: ({ children }) => wrapper({ children, ready: currentReady }),
    initialProps: initial,
  });
  const rerender = (next: { mode: PracticeModeId; ready: boolean }) => { currentReady = next.ready; hook.rerender(next); };
  return { ...hook, rerender, setLoop, controller, setLoopValue: (value: LoopConfig) => { loop = value; } };
}

describe("usePracticePlayback", () => {
  it("saves once across practice modes and restores the previous Shadowing loop", () => {
    const { rerender, setLoop, setLoopValue } = setup({ mode: "shadowing", ready: true });
    expect(setLoop).not.toHaveBeenCalled();
    rerender({ mode: "pronunciation", ready: true });
    expect(setLoop).toHaveBeenLastCalledWith({ enabled: false, autoPause: true });
    act(() => setLoopValue({ enabled: true, count: 0, autoPause: true }));
    rerender({ mode: "listening", ready: true });
    rerender({ mode: "shadowing", ready: true });
    expect(setLoop).toHaveBeenLastCalledWith(original);
    const calls = setLoop.mock.calls.length;
    rerender({ mode: "shadowing", ready: true });
    expect(setLoop).toHaveBeenCalledTimes(calls);
    act(() => setLoopValue({ enabled: false, count: 1, autoPause: false }));
    rerender({ mode: "pronunciation", ready: true });
    rerender({ mode: "shadowing", ready: true });
    expect(setLoop).toHaveBeenLastCalledWith({ enabled: false, count: 1, autoPause: false });
  });

  it("switching from Shadowing into a practice mode plays the current sentence once (D5)", () => {
    const { rerender, controller } = setup({ mode: "shadowing", ready: true });
    expect(controller.play).not.toHaveBeenCalled();
    rerender({ mode: "listening", ready: true });
    expect(controller.play).toHaveBeenCalledOnce();
    rerender({ mode: "listening", ready: true });
    expect(controller.play).toHaveBeenCalledOnce();
    rerender({ mode: "pronunciation", ready: true });
    expect(controller.play).toHaveBeenCalledTimes(2);
    rerender({ mode: "shadowing", ready: true });
    expect(controller.play).toHaveBeenCalledTimes(2);
  });

  it("a fresh load of a practice URL plays once, when the player is ready", () => {
    const { rerender, controller } = setup({ mode: "listening", ready: false });
    expect(controller.play).not.toHaveBeenCalled();
    rerender({ mode: "listening", ready: true });
    expect(controller.play).toHaveBeenCalledOnce();
    rerender({ mode: "listening", ready: true });
    expect(controller.play).toHaveBeenCalledOnce();
  });

  it("the loop is turned off before the entry play", () => {
    const { rerender, controller, setLoop } = setup({ mode: "shadowing", ready: true });
    rerender({ mode: "listening", ready: true });
    expect(setLoop.mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(controller.play).mock.invocationCallOrder[0]!);
  });

  it("Shadowing never plays on entry", () => {
    const { rerender, controller } = setup({ mode: "shadowing", ready: false });
    rerender({ mode: "shadowing", ready: true });
    expect(controller.play).not.toHaveBeenCalled();
  });
});
