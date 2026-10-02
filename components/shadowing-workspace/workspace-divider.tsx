"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

const STEP = 0.05;

export function clampSplit(ratio: number, width: number, leftMinimum: number, rightMinimum: number): number {
  if (width <= 0) return ratio;
  return Math.min(1 - rightMinimum / width, Math.max(leftMinimum / width, ratio));
}

function tokenPixels(root: HTMLElement, token: string): number {
  const probe = document.createElement("div");
  probe.className = "pointer-events-none absolute invisible";
  probe.style.width = `var(${token})`;
  root.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

export function WorkspaceDivider({ ratio, onChange, workspaceRef, ariaLabel, controls }: {
  ratio: number;
  onChange(ratio: number): void;
  workspaceRef: RefObject<HTMLElement>;
  ariaLabel: string;
  controls: string;
}) {
  const metricsRef = useRef<{ width: number; leftMinimum: number; rightMinimum: number } | null>(null);
  const [range, setRange] = useState({ min: 0, max: 100 });
  // Measured on mount, on focus and on pointer down: a window resize changes the real range (ARIA + clamp).
  const measure = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return null;
    const bounds = workspace.getBoundingClientRect();
    if (bounds.width <= 0) return null;
    const metrics = { width: bounds.width, leftMinimum: tokenPixels(workspace, "--workspace-left-min"), rightMinimum: tokenPixels(workspace, "--workspace-right-min") };
    metricsRef.current = metrics;
    setRange({ min: Math.ceil(metrics.leftMinimum / metrics.width * 100), max: Math.floor((1 - metrics.rightMinimum / metrics.width) * 100) });
    return metrics;
  }, [workspaceRef]);
  useEffect(() => { measure(); }, [measure]);
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const workspace = workspaceRef.current;
    const metrics = metricsRef.current;
    if (!workspace || !metrics) return;
    const bounds = workspace.getBoundingClientRect();
    const next = (event.clientX - bounds.left) / bounds.width;
    onChange(clampSplit(next, metrics.width, metrics.leftMinimum, metrics.rightMinimum));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = ratio + (event.key === "ArrowRight" ? STEP : -STEP);
    const metrics = metricsRef.current ?? measure();
    // Unmeasured (zero-width workspace): still never a negative or > 1 ratio, which would drop the whole template.
    if (!metrics) return onChange(Math.min(1, Math.max(0, next)));
    onChange(clampSplit(next, metrics.width, metrics.leftMinimum, metrics.rightMinimum));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-controls={controls}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={measure}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        measure();
        fromPointer(event);
      }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event); }}
      className="relative w-[--workspace-divider-width] touch-none select-none cursor-col-resize bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border focus-visible:after:bg-primary"
    />
  );
}
