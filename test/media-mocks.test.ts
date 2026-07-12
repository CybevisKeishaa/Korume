import { describe, expect, it, afterEach } from "vitest";
import {
  mockGetUserMedia,
  mockMediaRecorder,
  createFakeMediaStream,
  type GetUserMediaMockHandle,
  type MediaRecorderMockHandle,
} from "./media-mocks";

describe("mockGetUserMedia", () => {
  let handle: GetUserMediaMockHandle | undefined;

  afterEach(() => {
    handle?.restore();
    handle = undefined;
  });

  it("resolves with a fake stream and records constraints", async () => {
    handle = mockGetUserMedia();
    const constraints = { audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    expect(stream).toBe(handle.stream);
    expect(stream.getAudioTracks()).toHaveLength(1);
    expect(handle.calls).toEqual([constraints]);
  });

  it("rejects with the configured error", async () => {
    const denied = new DOMException("Permission denied", "NotAllowedError");
    handle = mockGetUserMedia({ rejectWith: denied });
    await expect(navigator.mediaDevices.getUserMedia()).rejects.toBe(denied);
  });

  it("restore() removes the fake mediaDevices", async () => {
    handle = mockGetUserMedia();
    handle.restore();
    // jsdom has no real mediaDevices, so after restore it should be gone again.
    expect((navigator as { mediaDevices?: unknown }).mediaDevices).toBeUndefined();
  });
});

describe("mockMediaRecorder", () => {
  let handle: MediaRecorderMockHandle | undefined;

  afterEach(() => {
    handle?.restore();
    handle = undefined;
  });

  it("installs a global MediaRecorder that tracks instances", () => {
    handle = mockMediaRecorder();
    const stream = createFakeMediaStream();
    const recorder = new MediaRecorder(stream);
    expect(handle.instances).toEqual([recorder]);
    expect(recorder.state).toBe("inactive");
  });

  it("start()/stop() transitions state and emits a dataavailable Blob then stop", () => {
    handle = mockMediaRecorder([new Uint8Array([1, 2, 3])]);
    const recorder = new MediaRecorder(createFakeMediaStream());

    const chunks: Blob[] = [];
    let stopped = false;
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      stopped = true;
    };

    recorder.start();
    expect(recorder.state).toBe("recording");

    recorder.stop();
    expect(recorder.state).toBe("inactive");
    expect(stopped).toBe(true);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.size).toBeGreaterThan(0);
  });

  it("restore() removes the fake global MediaRecorder", () => {
    handle = mockMediaRecorder();
    handle.restore();
    expect((globalThis as { MediaRecorder?: unknown }).MediaRecorder).toBeUndefined();
  });
});
