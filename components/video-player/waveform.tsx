"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { readBlobAsArrayBuffer } from "@/lib/audio/read-blob";

export interface WaveformProps {
  /** Recorded audio to visualize. Rendering is a no-op while null. */
  blob: Blob | null;
  /**
   * Accessible label for the canvas image. Optional override — omit it to
   * fall back to the translated `common.player.a11y.waveform` string via
   * `useTranslations`; pass it when a caller needs a more specific label
   * (e.g. "Your recording waveform").
   */
  label?: string;
  className?: string;
  height?: number;
}

type DecodeStatus = "idle" | "decoding" | "ready" | "unsupported";

const BUCKET_COUNT = 96;
const CANVAS_WIDTH = 600;

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
export function Waveform({ blob, label, className, height = 64 }: WaveformProps) {
  const t = useTranslations("common");
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
        <p className="text-xs text-muted-foreground">{t("player.processingRecording")}</p>
      )}
      {status === "unsupported" && (
        <p className="text-xs text-muted-foreground">{t("player.waveformUnavailable")}</p>
      )}
      {status === "ready" && (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label ?? t("player.a11y.waveform")}
          width={CANVAS_WIDTH}
          height={height}
          className="w-full"
        />
      )}
    </div>
  );
}
