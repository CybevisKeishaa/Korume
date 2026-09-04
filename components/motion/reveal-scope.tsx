"use client";

import { useEffect } from "react";

import { REVEAL_FAILSAFE_ATTR, REVEAL_MOUNTED_FLAG } from "./reveal-failsafe";

/**
 * One IntersectionObserver for the whole landing page: it flips every
 * `[data-reveal="pending"]` inside `[data-reveal-scope]` to `"in"` as it enters
 * view, and `app/globals.css` does the animating. Renders no DOM.
 *
 * Why one page-level observer instead of a wrapper component per section: a
 * wrapper adds a DOM node around measured content, and this branch asserts §6's
 * mascot/rail alignment to 1px. Attributes on elements that already exist
 * cannot move anything.
 *
 * It is mounted by the landing page, not the marketing layout, so it remounts
 * with the page (a locale switch replaces the tree) and so no other marketing
 * route silently inherits the behaviour.
 *
 * Reduce-motion needs no branch here: the CSS gate applies the hidden state
 * only when `data-reduce-motion="false"`, so flipping the attribute under the
 * app toggle animates nothing. The observer is left running rather than
 * conditionally skipped, because the toggle can change mid-session and the
 * attribute is then already correct.
 */
export function RevealScope(): null {
  useEffect(() => {
    // Hydration lost the race and the failsafe already revealed the page.
    // Flipping targets to `in` now would run `reveal-rise` from opacity 0 and
    // flash content the reader is already looking at.
    if (document.documentElement.hasAttribute(REVEAL_FAILSAFE_ATTR)) return;

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal-scope] [data-reveal="pending"]'),
    );
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "in";
          observer.unobserve(entry.target);
        }
      },
      // Ask for a little of the section to be in view, so the entrance starts
      // as the reader arrives rather than a moment before.
      { rootMargin: "0px 0px -10% 0px" },
    );

    for (const target of targets) observer.observe(target);

    // Report in HERE and nowhere earlier, so the inline failsafe stands down
    // for something it can rely on: the observer exists and is observing. Set
    // as the effect's first statement, this was the same substitution the
    // failsafe exists to correct — `new IntersectionObserver` throwing would
    // have disarmed the failsafe and left the page at opacity 0 for good.
    // Every path that returns before this line leaves the flag unset, and the
    // failsafe then releases the page a few seconds later: the safe direction.
    Reflect.set(window, REVEAL_MOUNTED_FLAG, true);

    return () => observer.disconnect();
  }, []);

  return null;
}
