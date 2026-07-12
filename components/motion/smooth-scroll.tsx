"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useTheme } from "@/components/providers/theme-provider";

/**
 * Lenis smooth-scroll provider for the cinematic marketing surface.
 * Disabled entirely under reduce-motion (OS or app toggle) — CLAUDE.md §2.4.
 * Not used inside repeated study flows (spec §9).
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const { reduceMotion } = useTheme();

  useEffect(() => {
    if (reduceMotion) return;

    const lenis = new Lenis();
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reduceMotion]);

  return <>{children}</>;
}
