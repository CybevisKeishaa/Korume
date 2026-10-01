"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { motionEnabled } from "@/lib/motion/motion-enabled";

/** How long a scroll the app started counts as its own when the browser has no `scrollend`. */
export const PROGRAMMATIC_SCROLL_MS = 600;
/**
 * With `scrollend` the window lasts until it fires; this caps it for a scroll that never moves (no
 * `scrollend`). Measured on Ep.729: a smooth "Back to current" over 1800 px outlasts 600 ms, so a fixed
 * 600 ms window re-suspended on the app's own scroll.
 */
export const PROGRAMMATIC_SCROLL_MAX_MS = 2000;
const SCROLL_KEYS = new Set(["PageUp", "PageDown", "Home", "End"]);

/**
 * Keeps the current transcript row centred in `containerRef` (spec §7.6). The container scrolls on its own
 * — the page never does. A learner scroll suspends following until `resume()`; the app's own scrolls are
 * flagged first (`programmaticUntil`) so a `scroll` they cause is never mistaken for the learner's.
 * `wheel`, `touchmove` and the paging keys only ever come from the learner, so they suspend at any time.
 * Rows are found by `data-index` (the line's position in `lines`, as `currentIndex` is). A new `layoutKey` (row heights changed, e.g. Full
 * Transcript) re-centres the same row.
 */
export function useAutoFollow(containerRef: RefObject<HTMLElement>, currentIndex: number | null, enabled: boolean, layoutKey?: string) {
  const [suspended, setSuspended] = useState(false);
  const programmaticUntil = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const mounted = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const suspend = () => { if (enabledRef.current) setSuspended(true); };
    const onScroll = () => { if (Date.now() >= programmaticUntil.current) suspend(); };
    const onScrollEnd = () => { programmaticUntil.current = 0; };
    const onKeyDown = (event: KeyboardEvent) => { if (SCROLL_KEYS.has(event.key)) suspend(); };
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("scrollend", onScrollEnd);
    container.addEventListener("wheel", suspend, { passive: true });
    container.addEventListener("touchmove", suspend, { passive: true });
    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("scrollend", onScrollEnd);
      container.removeEventListener("wheel", suspend);
      container.removeEventListener("touchmove", suspend);
      container.removeEventListener("keydown", onKeyDown);
    };
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled || suspended || currentIndex === null) return;
    const row = container.querySelector<HTMLElement>(`[data-index="${currentIndex}"]`);
    if (!row) return;
    const offset = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const centred = container.scrollTop + offset - (container.clientHeight - row.offsetHeight) / 2;
    const top = Math.max(0, Math.min(centred, container.scrollHeight - container.clientHeight));
    // Already there (centred, or clamped at an end): a scroll that never moves fires no `scrollend`, so
    // opening the window would blind the learner's own scroll for the full cap.
    if (Math.abs(top - container.scrollTop) < 1) { mounted.current = true; return; }
    // The first placement (page load) is never animated.
    const behavior: ScrollBehavior = mounted.current && motionEnabled() ? "smooth" : "instant";
    mounted.current = true;
    programmaticUntil.current = Date.now() + ("onscrollend" in window ? PROGRAMMATIC_SCROLL_MAX_MS : PROGRAMMATIC_SCROLL_MS);
    container.scrollTo({ top, behavior });
  }, [containerRef, currentIndex, enabled, suspended, layoutKey]);

  const resume = useCallback(() => setSuspended(false), []);
  return { suspended: suspended && enabled, resume };
}
