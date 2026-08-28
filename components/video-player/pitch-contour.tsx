"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { contourFromSamples, medianVoicedHz, toPlotPoints } from "@/lib/pitch";
import type { PitchContour as PitchContourData, PlotPoint } from "@/lib/pitch";
import { readBlobAsArrayBuffer } from "@/lib/audio/read-blob";

export interface PitchContourProps {
  /** Recorded audio to visualize. Rendering is a no-op while null. */
  blob: Blob | null;
  /**
   * Accessible label for the canvas image. Optional override — omit it to
   * fall back to the translated `shadowing.pitch.contour.a11y.label` string
   * via `useTranslations`; pass it when a caller needs a more specific label.
   */
  label?: string;
  className?: string;
  height?: number;
}

type Status = "idle" | "decoding" | "ready" | "unavailable";

const CANVAS_WIDTH = 600;
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

/** Draws the baseline gridline plus the semitone contour, breaking the line at gaps. */
function drawContour(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  points: (PlotPoint | null)[],
  baselineY: number,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Reference baseline (the speaker's own median pitch — semitone 0).
  // Was rgba(148, 163, 184, 0.4) — a mid-grey that read as a dim line against
  // a light card. Same 40% opacity, base colour flipped to white so it reads
  // as a faint hairline on the Korume dark surface instead (composites to
  // ~rgb(115,118,121) on --card #171a20, ~3.8:1 against it — clearly present
  // without competing with the ember contour line below).
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(canvas.width, baselineY);
  ctx.stroke();

  // getComputedStyle(canvas).color resolves the inherited `text-primary`
  // class (hsl(var(--primary)) = ember-500) into a literal the canvas 2D
  // context can use directly — canvas does not resolve CSS custom properties
  // itself. The literal fallback only fires if that resolution fails (e.g. a
  // detached canvas in a test environment); it mirrors --primary/--ember-500
  // (#ff8a3d), the one accent colour left in the palette after this
  // migration deleted the old indigo (#4f46e5, --indigo-600) it used to be.
  // Canvas cannot parse var(--primary) directly, so this literal has to be
  // hand-kept in sync with --ember-500 — if that primitive is ever
  // re-valued, this line goes stale exactly the way the indigo one did.
  const lineColor = getComputedStyle(canvas).color || "#ff8a3d";

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
export function PitchContour({ blob, label, className, height = 96 }: PitchContourProps) {
  const t = useTranslations("shadowing");
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
        <p className="text-xs text-muted-foreground">{t("pitch.contour.analyzing")}</p>
      )}
      {status === "unavailable" && (
        <p className="text-xs text-muted-foreground">{t("pitch.contour.unavailable")}</p>
      )}
      {status === "ready" && (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label ?? t("pitch.contour.a11y.label")}
          width={CANVAS_WIDTH}
          height={height}
          className="w-full"
        />
      )}
    </div>
  );
}
