"use client";

import { useEffect } from "react";

import { motionEnabled, subscribeMotionEnabled } from "@/lib/motion/motion-enabled";

/** Opt-in marker. A section without it is never tracked. */
export const SCROLL_PROGRESS_ATTR = "data-scroll-progress";
/** The custom property CSS reads. */
export const SCROLL_PROGRESS_VAR = "--section-progress";

/**
 * How far a section has travelled through the viewport, normalized to [0,1]:
 * 0 the instant its top touches the viewport bottom, 1 the instant its bottom
 * leaves the viewport top. Pure, so the mapping is testable without a DOM.
 */
export function sectionProgress(rect: DOMRect, viewportHeight: number): number {
  const total = rect.height + viewportHeight;
  if (total <= 0) return 0;
  const travelled = viewportHeight - rect.top;
  return Math.min(1, Math.max(0, travelled / total));
}

/**
 * Writes `--section-progress` on every `[data-scroll-progress]` section while it
 * is on screen. Renders no DOM: it is a behaviour, and a wrapper element would
 * move measured geometry.
 *
 * ⚠️ This is a CAPABILITY, not an obligation (spec §6.3). §1 Hero is its only
 * consumer. Wiring an entrance-driven section to it because it happens to exist
 * is the same failure mode as putting a thread segment in every section.
 *
 * Only intersecting sections compute — the observer adds and removes them from
 * the active set — and the rAF loop stops entirely when that set is empty.
 */
export function ScrollProgress(): null {
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(`[${SCROLL_PROGRESS_ATTR}]`),
    );
    if (sections.length === 0) return;

    /**
     * Motion off: the UNDISTORTED state, written once. Never an intermediate
     * value, never a loop.
     *
     * ⚠️ `0`, not `1`, and this is load-bearing. Consumers of this property use
     * it in a static `transform` — and a static transform is reachable by
     * NEITHER kill-switch block in `app/globals.css`: both collapse only
     * `animation-*` and `transition-*`. Settling to `1` would therefore leave
     * §1's hero card permanently at `scale(0.94)` for a reduce-motion reader —
     * content distorted by the motion system, for the one reader who asked for
     * none. `0` is the resting value, `motionEnabled()` is already the correct
     * OR over both inputs, and `var(--section-progress, 0)` gives the same
     * answer when JS never runs — one mechanism, correct in every combination.
     *
     * ▶ If a future consumer's natural resting state is `1` rather than `0`,
     * do NOT flip this global. Give that consumer a CSS rule gated on
     * `:root[data-reduce-motion="false"]` plus a `@media (prefers-reduced-motion)`
     * reset, and say why in its docblock.
     */
    const settle = () => {
      for (const section of sections) {
        section.style.setProperty(SCROLL_PROGRESS_VAR, "0");
      }
    };

    if (!motionEnabled()) {
      settle();
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- motion is already off; there is nothing to react to until the toggle flips, and the unsubscribe still needs to be returned for symmetric teardown.
      return subscribeMotionEnabled(() => {});
    }

    const active = new Set<HTMLElement>();
    let frame = 0;

    const tick = () => {
      for (const section of active) {
        const progress = sectionProgress(
          section.getBoundingClientRect(),
          window.innerHeight,
        );
        section.style.setProperty(SCROLL_PROGRESS_VAR, progress.toFixed(4));
      }
      frame = active.size > 0 ? window.requestAnimationFrame(tick) : 0;
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = entry.target as HTMLElement;
        if (entry.isIntersecting) active.add(section);
        else active.delete(section);
      }
      if (active.size > 0 && frame === 0) frame = window.requestAnimationFrame(tick);
    });

    for (const section of sections) observer.observe(section);

    // The toggle can flip mid-session. Settling on the spot beats waiting for
    // the next scroll, which may never come.
    const unsubscribe = subscribeMotionEnabled((enabled) => {
      if (enabled) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
      active.clear();
      settle();
    });

    return () => {
      unsubscribe();
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
