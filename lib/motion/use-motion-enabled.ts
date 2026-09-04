"use client";

import { useSyncExternalStore } from "react";

import { motionEnabled, subscribeMotionEnabled } from "./motion-enabled";

/**
 * React's view of the gate. The server snapshot is `false` so the markup React
 * hydrates against is the static state — the same state a reduce-motion reader
 * keeps, and never a frame of animation assumed before the gate is readable.
 */
export function useMotionEnabled(): boolean {
  return useSyncExternalStore(
    subscribeMotionEnabled,
    motionEnabled,
    () => false,
  );
}
