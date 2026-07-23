import { afterEach, describe, expect, it } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHook } from "@/test/render";
import {
  mockGetUserMedia,
  mockMediaRecorder,
  type GetUserMediaMockHandle,
  type MediaRecorderMockHandle,
} from "@/test/media-mocks";
import { useRecorder } from "./recorder";

describe("useRecorder", () => {
  let gum: GetUserMediaMockHandle | undefined;
  let mr: MediaRecorderMockHandle | undefined;

  afterEach(() => {
    gum?.restore();
    mr?.restore();
    gum = undefined;
    mr = undefined;
  });

  it("starts idle", () => {
    mr = mockMediaRecorder();
    gum = mockGetUserMedia();
    const { result } = renderHook(() => useRecorder());
    expect(result.current.state).toBe("idle");
    expect(result.current.blob).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("requests the mic, records, and produces a Blob on stop", async () => {
    mr = mockMediaRecorder([new Uint8Array([1, 2, 3, 4])]);
    gum = mockGetUserMedia();
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(gum.calls).toEqual([{ audio: true }]);
    expect(result.current.state).toBe("recording");
    expect(mr.instances).toHaveLength(1);

    act(() => {
      result.current.stop();
    });

    await waitFor(() => expect(result.current.state).toBe("recorded"));
    expect(result.current.blob).toBeInstanceOf(Blob);
    expect(result.current.blob?.size).toBeGreaterThan(0);
  });

  it("stops all mic tracks once recording stops", async () => {
    mr = mockMediaRecorder();
    gum = mockGetUserMedia();
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });
    const [track] = gum.stream.getAudioTracks();
    expect(track?.readyState).toBe("live");

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state).toBe("recorded"));
    expect(track?.readyState).toBe("ended");
  });

  it("stops all mic tracks on unmount while still recording (no orphaned capture)", async () => {
    mr = mockMediaRecorder();
    gum = mockGetUserMedia();
    const { result, unmount } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("recording");
    const [track] = gum.stream.getAudioTracks();
    expect(track?.readyState).toBe("live");

    act(() => unmount());

    expect(track?.readyState).toBe("ended");
    // The fake MediaRecorder.stop() is idempotent (no-ops once inactive), so
    // this also proves cleanup didn't try to double-stop it.
    expect(mr.instances[0]?.state).toBe("inactive");
  });

  it("surfaces a friendly message when permission is denied", async () => {
    mr = mockMediaRecorder();
    gum = mockGetUserMedia({
      rejectWith: new DOMException("Permission denied", "NotAllowedError"),
    });
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/microphone access was denied/i);
    expect(result.current.blob).toBeNull();
  });

  it("surfaces a friendly message when no microphone is found", async () => {
    // review finding, Important 2: micNotFound had a correct pin but no test
    // ever rendered/asserted it.
    mr = mockMediaRecorder();
    gum = mockGetUserMedia({
      rejectWith: new DOMException("nope", "NotFoundError"),
    });
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/no microphone was found/i);
  });

  it("surfaces a generic friendly message for any other getUserMedia rejection", async () => {
    // review finding, Important 2: the generic micUnavailable fallback is the
    // one no test would catch resolving to the wrong catalog entry — a plain
    // Error (not a DOMException with a recognized `name`) exercises it.
    mr = mockMediaRecorder();
    gum = mockGetUserMedia({ rejectWith: new Error("boom") });
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/couldn't access your microphone/i);
  });

  it("surfaces a friendly message when the MediaRecorder itself errors mid-recording", async () => {
    // review finding, Important 2: recordingFailed (the MediaRecorder
    // onerror path) had a correct pin but no test ever rendered/asserted it.
    mr = mockMediaRecorder();
    gum = mockGetUserMedia();
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("recording");

    act(() => {
      mr?.instances[0]?.onerror?.(new Event("error"));
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/recording failed/i);
  });

  it("reset clears the blob/error and returns to idle", async () => {
    mr = mockMediaRecorder();
    gum = mockGetUserMedia({
      rejectWith: new DOMException("nope", "NotAllowedError"),
    });
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("error");

    act(() => result.current.reset());

    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.blob).toBeNull();
  });

  it("errors with an unsupported message when the browser has no mic APIs", async () => {
    // No media-mocks installed here on purpose: jsdom has neither
    // `navigator.mediaDevices` nor `MediaRecorder` by default.
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/isn't supported/i);
  });
});
