"use client";

import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { DRAWER_LEVELS, nearestDrawerLevel, type DrawerAction, type DrawerLevel } from "@/lib/shadowing-workspace/drawer-state";

function tokenPixels(root: HTMLElement, token: string): number {
  const probe = document.createElement("div");
  probe.className = "pointer-events-none absolute invisible";
  probe.style.height = `var(${token})`;
  root.append(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

/**
 * The drawer's resize handle (spec §6.1): a horizontal separator whose value is the level index. Arrow keys
 * step a level, Home/End jump to collapsed/maximized, and a drag snaps to the nearest of the four levels.
 */
export function DrawerSeparator({ level, dispatch, workspaceRef, headerRef, label, valueText, controls }: {
  level: DrawerLevel;
  dispatch(action: DrawerAction): void;
  workspaceRef: RefObject<HTMLElement>;
  headerRef: RefObject<HTMLElement>;
  label: string;
  valueText: string;
  controls: string;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action: DrawerAction | null =
      event.key === "ArrowUp" ? { type: "step", delta: 1 }
        : event.key === "ArrowDown" ? { type: "step", delta: -1 }
          : event.key === "Home" ? { type: "set-level", level: "collapsed" }
            : event.key === "End" ? { type: "set-level", level: "maximized" }
              : null;
    if (!action) return;
    event.preventDefault();
    dispatch(action);
  };
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const bounds = workspace.getBoundingClientRect();
    if (bounds.height <= 0) return;
    const header = headerRef.current?.getBoundingClientRect().height ?? 0;
    const level = nearestDrawerLevel(bounds.bottom - event.clientY, {
      collapsed: tokenPixels(workspace, "--drawer-collapsed-height"),
      peekMin: tokenPixels(workspace, "--drawer-peek-min"),
      available: bounds.height - header,
      viewport: bounds.height,
    });
    dispatch({ type: "set-level", level });
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-controls={controls}
      aria-valuemin={0}
      aria-valuemax={DRAWER_LEVELS.length - 1}
      aria-valuenow={DRAWER_LEVELS.indexOf(level)}
      aria-valuetext={valueText}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        fromPointer(event);
      }}
      className="relative h-xs w-full touch-none select-none cursor-row-resize outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-x-0 after:top-1/2 after:h-px after:-translate-y-1/2 after:bg-border focus-visible:after:bg-primary"
    />
  );
}
