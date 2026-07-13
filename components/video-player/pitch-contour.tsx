"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { contourFromSamples, hzToSemitones, medianVoicedHz } from "@/lib/pitch";
import type { PitchContour as PitchContourData } from "@/lib/pitch";
import { readBlobAsArrayBuffer } from "@/lib/audio/read-blob";

export interface PitchContourProps {
  /** Recorded audio to visualize. Rendering is a no-op while null. */
  blob: Blob | null;
  /** Accessible label for the canvas image. Defaults to "Your pitch contour for this take". */
  label?: string;
  className?: string;
  height?: number;
}

type Status = "idle" | "decoding" | "ready" | "unavailable";

const CANVAS_WIDTH = 600;
/** Minimum vertical span (in semitones) to plot even when the take is nearly flat. */
const MIN_SEMITONE_SPAN = 4;
/** Extra headroom (in semitones) above/below the observed data range. */
const RANGE_PADDING_SEMITONES = 1;
const POINT_RADIUS = 1.5;

/**
 * Runs the B1 pitch pipeline (`contourFromSamples`) on a decoded mono channel
 * and derives the speaker-relative reference (median voiced Hz). Returns
 * `null` when the clip has no voiced frames at all (pure silence/noise) —
 * nothing meaningful to plot.
 */
function computePitchContour(
  samples: Float32Array,
  sampleRate: number,
): { contour: PitchContourData; refHz: number } | null {
  const contour = contourFromSamples(samples, sampleRate);
  if (contour === null) return null;
  const refHz = medianVoicedHz(contour.frames);
  if (refHz === null) return null;
  return { contour, refHz };
}

interface PlotPoint {
  x: number;
  y: number;
}

/** Maps contour frames to canvas-space points, one per frame, `null` = gap (unvoiced). */
function toPlotPoints(
  contour: PitchContourData,
  refHz: number,
  canvasWidth: number,
  canvasHeight: number,
): { points: (PlotPoint | null)[]; baselineY: number } {
  const frames = contour.frames;
  const maxTime = frames.length > 0 ? (frames[frames.length - 1] as { time: number }).time : 0;

  const semitones = frames.map((f) => (f.hz === null ? null : hzToSemitones(f.hz, refHz)));
  const voiced = semitones.filter((s): s is number => s !== null);
  const dataMin = voiced.length > 0 ? Math.min(...voiced) : 0;
  const dataMax = voiced.length > 0 ? Math.max(...voiced) : 0;

  let min = dataMin - RANGE_PADDING_SEMITONES;
  let max = dataMax + RANGE_PADDING_SEMITONES;
  if (max - min < MIN_SEMITONE_SPAN) {
    const centre = (max + min) / 2;
    min = centre - MIN_SEMITONE_SPAN / 2;
    max = centre + MIN_SEMITONE_SPAN / 2;
  }
  const span = max - min;

  const toY = (semitone: number) => canvasHeight - ((semitone - min) / span) * canvasHeight;
  const toX = (time: number) => (maxTime > 0 ? (time / maxTime) * canvasWidth : 0);

  const points = frames.map((f, i) => {
    const s = semitones[i];
    if (s === null || s === undefined) return null;
    return { x: toX(f.time), y: toY(s) };
  });

  return { points, baselineY: toY(0) };
}

/** Draws the baseline gridline plus the semitone contour, breaking the line at gaps. */
function drawContour(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  points: (PlotPoint | null)[],
  baselineY: number,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Reference baseline (the speaker's own median pitch — semitone 0).
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)"; // light, decorative gridline
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(canvas.width, baselineY);
  ctx.stroke();

  const lineColor = getComputedStyle(canvas).color || "#4f46e5";

  // Contour line — a new subpath starts after every gap so unvoiced spans
  // never get bridged by a straight line.
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  let drawing = false;
  for (const p of points) {
    if (!p) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      ctx.moveTo(p.x, p.y);
      drawing = true;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();

  // Small dots at each voiced frame for at-a-glance readability.
  ctx.fillStyle = lineColor;
  for (const p of points) {
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders the pitch (F0) contour of the user's OWN recording — 差別化 #1
 * (CLAUDE.md §5.1, spec §10.1). Layer 3 scope only: shows the user's
 * intonation shape, no reference overlay and no score (that lands in
 * Layer 4 once TTS reference audio + accent data exist — see the seam
 * documented in `lib/pitch/f0.ts`).
 *
 * Draws once, synchronously with the data — no drawing-in animation, so
 * there is nothing for `prefers-reduced-motion` to disable (CLAUDE.md §2.4).
 */
export function PitchContour({
  blob,
  label = "Your pitch contour for this take",
  className,
  height = 96,
}: PitchContourProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [plot, setPlot] = useState<{ points: (PlotPoint | null)[]; baselineY: number } | null>(
    null,
  );
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!blob) {
      setPlot(null);
      setStatus("idle");
      return;
    }

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      setStatus("unavailable");
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

        const result = computePitchContour(audioBuffer.getChannelData(0), audioBuffer.sampleRate);
        if (!result) {
          setStatus("unavailable"); // fully unvoiced clip — nothing to plot
          return;
        }
        setPlot(toPlotPoints(result.contour, result.refHz, CANVAS_WIDTH, height));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("unavailable");
      } finally {
        void ctx.close?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, height]);

  useEffect(() => {
    if (status !== "ready" || !plot) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return; // no canvas 2D backend available — fail silently
    drawContour(ctx, canvas, plot.points, plot.baselineY);
  }, [plot, status]);

  return (
    <div className={cn("text-primary", className)}>
      {status === "decoding" && (
        <p className="text-xs text-muted-foreground">Analyzing pitch…</p>
      )}
      {status === "unavailable" && (
        <p className="text-xs text-muted-foreground">Pitch contour unavailable</p>
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
