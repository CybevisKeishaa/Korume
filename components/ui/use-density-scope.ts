"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The density scope a portaled primitive was opened from.
 *
 * Radix portals to document.body, outside every route-group subtree, so
 * content opened inside a `data-density="reference"` group would otherwise
 * inherit the app's fluid density. Render `<span hidden ref={anchorRef} />`
 * where the primitive sits and spread `data-density={density}` on the
 * portaled content: the `[data-density]` block in globals.css re-declares
 * every derived token on that element, so it resolves at the scope's density
 * without moving the DOM (a portal moved into the scope would inherit its
 * stacking context and remount on attach).
 *
 * `hidden` keeps the anchor out of layout, and out of Tailwind's
 * `space-*` / `divide-*` sibling selectors. useEffect keeps it out of the
 * server render; an overlay already open on mount picks up its scope one
 * commit later.
 */
export function useDensityScope() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [density, setDensity] = useState<string>();

  useEffect(() => {
    setDensity(anchorRef.current?.closest("[data-density]")?.getAttribute("data-density") ?? undefined);
  }, []);

  return { anchorRef, density };
}
