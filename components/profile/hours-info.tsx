"use client";

import { useId, useState } from "react";

/**
 * The hours row info button and its hint. The only client island on /profile: Escape must dismiss the hint
 * without moving focus (WCAG 1.4.13), which needs state. Hover or focus brings it back.
 */
export function HoursInfo({ label, hint }: { label: string; hint: string }) {
  const hintId = useId();
  const [dismissed, setDismissed] = useState(false);
  return (
    <span
      className="group relative inline-flex"
      onKeyDown={(e) => { if (e.key === "Escape") setDismissed(true); }}
      onPointerEnter={() => setDismissed(false)}
      onFocus={() => setDismissed(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={hintId}
        className="inline-flex size-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground"
      >
        i
      </button>
      <span
        id={hintId}
        role="tooltip"
        data-dismissed={dismissed ? "true" : undefined}
        className={`invisible absolute end-0 top-full z-popover mt-2xs w-56 rounded-md bg-foreground px-xs py-2xs text-caption font-normal text-background shadow-overlay ${dismissed ? "" : "group-focus-within:visible group-hover:visible"}`}
      >
        {hint}
      </span>
    </span>
  );
}
