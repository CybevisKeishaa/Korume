"use client";

import { useCallback, useRef } from "react";

/**
 * The density scope a portaled primitive was opened from.
 *
 * Radix portals to document.body, outside every route-group subtree, so
 * content opened inside a `data-density="reference"` group would otherwise
 * inherit the app's fluid density. Render `<span hidden ref={anchorRef} />`
 * where the primitive sits and pass `contentRef` as the portaled content's
 * ref: it copies the nearest `data-density` onto that element, where the
 * `[data-density]` block in globals.css re-declares every derived token. The
 * DOM stays where Radix puts it — a portal moved into the scope would inherit
 * its stacking context and remount on attach.
 *
 * The scope is read when the CONTENT mounts, in the layout phase before
 * paint, not once when the primitive mounts. A mount-time read inside an
 * already-open Dialog runs before that Dialog's content carries the
 * attribute, so a nested Select would resolve at fluid density for good.
 *
 * `hidden` keeps the anchor out of layout, and out of Tailwind's
 * `space-*` / `divide-*` sibling selectors.
 */
export function useDensityScope() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const contentRef = useCallback((content: HTMLElement | null) => {
    const density = anchorRef.current?.closest("[data-density]")?.getAttribute("data-density");
    if (content && density) content.setAttribute("data-density", density);
  }, []);

  return { anchorRef, contentRef };
}
