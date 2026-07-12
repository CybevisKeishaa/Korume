"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Lifecycle of a single shadowing recording attempt. */
export type RecorderState = "idle" | "requesting-permission" | "recording" | "recorded" | "error";

export interface UseRecorderResult {
  state: RecorderState;
  /** The recorded audio once `state` is "recorded", else null. */
  blob: Blob | null;
  /** Human-readable message when `state` is "error", else null. */
  error: string | null;
  /** Requests mic access and starts recording. No-op while already recording/requesting. */
  start: () => Promise<void>;
  /** Stops an in-progress recording, producing `blob` via `onstop`. No-op if not recording. */
  stop: () => void;
  /** Discards any recording/error and returns to "idle". */
  reset: () => void;
}

const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm"];

/** Picks the first MediaRecorder-supported mime type from our preference list. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Maps a getUserMedia rejection to a friendly, non-technical message. */
function describeMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : undefined;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone access was denied. Allow microphone access in your browser settings to record.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found. Connect a microphone and try again.";
  }
  return "Couldn't access your microphone. Check your device and try again.";
}

/**
 * Captures a single shadowing take: mic permission → MediaRecorder → Blob.
 * This owns recording capture only — upload/playback live in
 * `ShadowingRecorderPanel`, which composes this hook with `Waveform`. That
 * separation is also the seam B2 (pitch accent) reuses: it can call
 * `useRecorder` again for its own capture without touching upload/UI code.
 */
export function useRecorder(): UseRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guard checks need the *current* state synchronously (start/stop can be
  // called from event handlers before a re-render lands), so mirror it in a
  // ref alongside the state used for rendering.
  const stateRef = useRef<RecorderState>("idle");
  stateRef.current = state;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  // Tracks whether the component is still mounted so async continuations
  // (the getUserMedia await, and recorder callbacks that can fire after
  // unmount stops them) never call setState on an unmounted component, and
  // so a mic granted after unmount is released immediately instead of
  // starting a recording nobody can see or stop.
  const mountedRef = useRef(true);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (stateRef.current === "recording" || stateRef.current === "requesting-permission") return;

    setError(null);
    setBlob(null);
    setState("requesting-permission");

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser.");
      setState("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(describeMicError(err));
      setState("error");
      return;
    }

    if (!mountedRef.current) {
      // Unmounted while permission was pending — release the mic we were
      // just granted instead of orphaning it.
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      cleanupStream();
      if (!mountedRef.current) return;
      setBlob(new Blob(chunksRef.current, { type: mimeType ?? "audio/webm" }));
      setState("recorded");
    };
    recorder.onerror = () => {
      cleanupStream();
      if (!mountedRef.current) return;
      setError("Recording failed. Try again.");
      setState("error");
    };

    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
  }, [cleanupStream]);

  const stop = useCallback(() => {
    if (stateRef.current !== "recording") return;
    recorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    if (stateRef.current === "recording") recorderRef.current?.stop();
    cleanupStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setBlob(null);
    setError(null);
    setState("idle");
  }, [cleanupStream]);

  // Unmount cleanup: stop an in-progress recording and release the mic. A
  // real MediaRecorder's `stop()` fires `onstop` asynchronously, so we can't
  // rely on that handler alone to release tracks before the browser's mic
  // indicator would otherwise stay lit — release the stream directly here
  // too. `mountedRef` flips to false first so any `onstop`/`onerror` that
  // still fires afterwards (real recorder) skips its `setState` calls.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      // Guard against double-stop: a real MediaRecorder throws
      // InvalidStateError if `stop()` is called while already "inactive".
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  return { state, blob, error, start, stop, reset };
}
