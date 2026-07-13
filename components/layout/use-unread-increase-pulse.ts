"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Detects when `value` increases *after* it has already been observed once,
 * and returns a key that changes exactly once per increase.
 *
 * Used to gate the notification bell's unread-count pulse (Layer 6,
 * motion-engineer): the very first observed value — e.g. the initial fetch
 * populating the unread count on mount — must NOT count as an "increase", or
 * every dashboard visit would pulse. Only a later rise while the component
 * stays mounted (a genuinely new notification arriving) should. Callers key
 * the animated element off the returned number so a change remounts it and
 * retriggers a one-shot (non-looping) CSS animation; comparing
 * `returned value > 0` also tells a caller whether *any* increase has
 * happened yet, for gating the animation class itself.
 */
export function useUnreadIncreasePulse(value: number): number {
  const previous = useRef<number | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (previous.current !== null && value > previous.current) {
      setPulseKey((key) => key + 1);
    }
    previous.current = value;
  }, [value]);

  return pulseKey;
}
