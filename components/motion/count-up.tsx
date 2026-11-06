"use client";

import { useEffect, useState } from "react";
import { motionEnabled } from "@/lib/motion/motion-enabled";

/** Expo-out, the JS twin of `--ease-out-expo`: most of the climb early, a long settle onto the value. */
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * A number that counts up from 0 to `value` over `--duration-slow` when it mounts. Reduced motion (the app switch or
 * the OS, `motionEnabled`) shows `value` from the first render, with no frame of 0.
 */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(() => (motionEnabled() ? 0 : value));

  useEffect(() => {
    if (!motionEnabled()) return setShown(value);
    const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--duration-slow")) || 0;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = duration > 0 ? Math.max(0, now - start) / duration : 1;
      setShown(Math.round(value * easeOutExpo(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown}</>;
}
