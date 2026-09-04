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
 *
 * ⚠️ One state machine, not two. Motion off must not merely stop the loop —
 * it must stay stopped until motion is explicitly re-enabled, whether that
 * "off" was true from the very first render (a persisted `localStorage`
 * preference, seeded before paint) or arrived mid-session from the toggle,
 * and whether or not the section scrolls out of view and back in (or a
 * resize recomputes the ratio) while it's off. There is exactly one branch
 * below, built unconditionally on mount: `paused` — never an unbuilt
 * observer and never an emptied `active` set — is what gates the loop.
 * `active` keeps tracking real on-screen geometry in both directions
 * regardless of `paused`, so turning motion on, from either starting state,
 * resumes immediately for whatever is on screen right now instead of
 * leaving the page dead until the reader scrolls again or reloads. An
 * earlier version special-cased "motion already off at mount" as a
 * permanent no-op subscription with no observer to resume through — the
 * same defect the mid-session paused-forgets-active bug was, through a
 * different door, because it was a second copy of this state machine that
 * could (and did) drift out of sync with the first.
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

    const active = new Set<HTMLElement>();
    let frame = 0;
    // Gates rescheduling only. `active` is never cleared by this flag — the
    // observer is the single source of truth for what is on screen, in both
    // directions, whether paused or not. Seeded from the gate so a mount that
    // starts with motion off is paused from the first frame, with the same
    // observer and the same resume path as a mid-session toggle. See the
    // docblock above.
    let paused = !motionEnabled();
    if (paused) settle();

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
      if (!paused && active.size > 0 && frame === 0) {
        frame = window.requestAnimationFrame(tick);
      }
    });

    for (const section of sections) observer.observe(section);

    // The toggle can flip mid-session, in either direction.
    const unsubscribe = subscribeMotionEnabled((enabled) => {
      if (!enabled) {
        // Settling on the spot beats waiting for the next scroll, which may
        // never come. `active` is left untouched — pausing is not forgetting.
        paused = true;
        window.cancelAnimationFrame(frame);
        frame = 0;
        settle();
        return;
      }
      paused = false;
      // Whatever is on screen right now resumes immediately; nothing waits
      // for a fresh intersection event that a static page may never fire.
      if (active.size > 0 && frame === 0) frame = window.requestAnimationFrame(tick);
    });

    return () => {
      unsubscribe();
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
