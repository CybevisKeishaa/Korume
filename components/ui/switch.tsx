"use client";

import { cn } from "@/lib/utils";

/**
 * Two-state switch for a settings row (settings spec §4.4, §4.5).
 *
 * A native `<button>`, so Space and Enter activate it for free and the
 * disabled state is the platform's rather than ours. The thumb moves by flex
 * alignment — `justify-start` / `justify-end` — so there is no translate
 * arithmetic to keep in step with the track size.
 */
export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        // 24 tall (p-2xs + icon-sm thumb + p-2xs), 48 wide. `--icon-md` lives in
        // Tailwind's `size` scale and not in `height`, so `h-icon-md` generates
        // no rule at all — measured against compiled CSS. With no definite
        // block size there is nothing for an aspect ratio to work from, so both
        // axes read the token directly.
        "inline-flex h-[--icon-md] w-[calc(2_*_var(--icon-md))] shrink-0 items-center rounded-full p-2xs",
        "transition-colors duration-fast",
        checked ? "justify-end bg-primary" : "justify-start bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span className="size-icon-sm rounded-full bg-foreground" />
    </button>
  );
}
