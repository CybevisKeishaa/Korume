import { act } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@/test/render";
import { createFakeMediaStream, FakeMediaRecorder } from "@/test/media-mocks";
import { useRecorder } from "./recorder";

const originalDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
function install(getUserMedia: () => Promise<MediaStream>, Recorder: typeof FakeMediaRecorder = FakeMediaRecorder) {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", Recorder);
}
function expectTracks(stream: MediaStream, state: MediaStreamTrackState) {
  const tracks = stream.getTracks(); expect(tracks).toHaveLength(2);
  for (const track of tracks) expect(track.readyState).toBe(state);
}
describe("recorder cancellation boundaries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalDevices) Object.defineProperty(navigator, "mediaDevices", originalDevices);
    else Reflect.deleteProperty(navigator, "mediaDevices");
  });
  it.each(["constructor", "start"])("releases every acquired track and reports retryable error on %s failure", async (stage) => {
    const stream = createFakeMediaStream({ audioTrackCount: 2 });
    class BrokenRecorder extends FakeMediaRecorder {
      constructor(input: MediaStream) { super(input); if (stage === "constructor") throw new Error("construction failed"); }
      start() { throw new Error("start failed"); }
    }
    install(async () => stream, BrokenRecorder);
    const { result } = renderHook(useRecorder);
    await act(async () => { await result.current.start().catch(() => undefined); });
    expectTracks(stream, "ended");
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("Recording failed. Try again.");
  });
  it.each(["reset", "unmount"])("releases a late microphone grant after %s", async (action) => {
    const stream = createFakeMediaStream({ audioTrackCount: 2 });
    let grant!: (stream: MediaStream) => void;
    install(() => new Promise((resolve) => { grant = resolve; }));
    const { result, unmount } = renderHook(useRecorder);
    let pending: Promise<void>;
    act(() => { pending = result.current.start(); });
    act(() => { if (action === "reset") result.current.reset(); else unmount(); });
    await act(async () => { grant(stream); await pending; });
    expectTracks(stream, "ended");
    if (action === "reset") expect(result.current.state).toBe("idle");
  });
  it("ignores old recorder callbacks after reset and a new start, without stopping the new stream", async () => {
    const oldStream = createFakeMediaStream({ audioTrackCount: 2 });
    const newStream = createFakeMediaStream({ audioTrackCount: 2 });
    const instances: FakeMediaRecorder[] = [];
    class DeferredStopRecorder extends FakeMediaRecorder {
      constructor(stream: MediaStream) { super(stream); instances.push(this); }
      stop() { this.state = "inactive"; }
    }
    const grants = vi.fn().mockResolvedValueOnce(oldStream).mockResolvedValueOnce(newStream);
    install(grants, DeferredStopRecorder);
    const { result } = renderHook(useRecorder);
    await act(async () => { await result.current.start(); });
    const old = instances[0]; expect(old).toBeDefined();
    act(() => result.current.reset());
    await act(async () => { await result.current.start(); });
    act(() => { old?.onstop?.(new Event("stop")); old?.onerror?.(new Event("error")); });
    expect(result.current.state).toBe("recording"); expect(result.current.blob).toBeNull();
    expectTracks(oldStream, "ended"); expectTracks(newStream, "live");
  });
  it("allows panel cleanup to stop again after the hook released the recorder", async () => {
    const stream = createFakeMediaStream({ audioTrackCount: 2 });
    class StrictRecorder extends FakeMediaRecorder {
      stop() { if (this.state === "inactive") throw new DOMException("already stopped", "InvalidStateError"); this.state = "inactive"; }
    }
    install(async () => stream, StrictRecorder);
    const { result, unmount } = renderHook(() => {
      const recorder = useRecorder(); const latest = useRef(recorder); latest.current = recorder;
      useEffect(() => () => latest.current.stop(), []);
      return recorder;
    });
    await act(async () => { await result.current.start(); });
    expect(() => unmount()).not.toThrow();
    expectTracks(stream, "ended");
  });
});
