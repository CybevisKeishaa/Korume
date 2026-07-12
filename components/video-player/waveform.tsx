"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface WaveformProps {
  /** Recorded audio to visualize. Rendering is a no-op while null. */
  blob: Blob | null;
  /** Accessible label for the canvas image. Defaults to "Recording waveform". */
  label?: string;
  className?: string;
  height?: number;
}

type DecodeStatus = "idle" | "decoding" | "ready" | "unsupported";

const BUCKET_COUNT = 96;
const CANVAS_WIDTH = 600;

/**
 * Reads a `Blob` as an `ArrayBuffer`. Prefers the modern `Blob.arrayBuffer()`
 * method, falling back to `FileReader` for environments that implement Blob
 * without it (older Safari; also jsdom in this project's test environment).
 */
function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read recording"));
    reader.readAsArrayBuffer(blob);
  });
}

/** Per-bucket peak amplitude (0..1) envelope from an AudioBuffer's first channel. */
function computeEnvelope(buffer: AudioBuffer, buckets: number): number[] {
  const data = buffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(data.length / buckets));
  const envelope: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = i * bucketSize;
    const end = Math.min(data.length, start + bucketSize);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(data[j] ?? 0);
      if (abs > peak) peak = abs;
    }
    envelope.push(peak);
  }
  return envelope;
}

/**
 * Decodes and draws the amplitude envelope of the user's OWN recording.
 *
 * Per CLAUDE.md §2, this never extracts or compares YouTube's source audio —
 * it only ever reads a local `Blob` produced by `useRecorder`. The
 * cross-origin YouTube iframe's audio is inaccessible to Web Audio anyway.
 */
export function Waveform({
  blob,
  label = "Recording waveform",
  className,
  height = 64,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [envelope, setEnvelope] = useState<number[] | null>(null);
  const [status, setStatus] = useState<DecodeStatus>("idle");

  useEffect(() => {
    if (!blob) {
      setEnvelope(null);
      setStatus("idle");
      return;
    }

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    setStatus("decoding");
    const ctx = new AudioCtx();

    void (async () => {
      try {
        const arrayBuffer = await readBlobAsArrayBuffer(blob);
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        setEnvelope(computeEnvelope(audioBuffer, BUCKET_COUNT));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("unsupported");
      } finally {
        void ctx.close?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  useEffect(() => {
    if (status !== "ready" || !envelope) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return; // no canvas 2D backend available — fail silently

    const barWidth = canvas.width / envelope.length;
    const mid = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(canvas).color || "#4f46e5";
    envelope.forEach((amp, i) => {
      const barHeight = Math.max(1, amp * mid);
      ctx.fillRect(i * barWidth, mid - barHeight, Math.max(1, barWidth - 1), barHeight * 2);
    });
  }, [envelope, status]);

  return (
    <div className={cn("text-primary", className)}>
      {status === "decoding" && (
        <p className="text-xs text-muted-foreground">Processing recording…</p>
      )}
      {status === "unsupported" && (
        <p className="text-xs text-muted-foreground">Waveform preview unavailable.</p>
      )}
      {status === "ready" && (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          width={CANVAS_WIDTH}
          height={height}
          className="w-full"
        />
      )}
    </div>
  );
}
