"use client";

import { useId } from "react";
import { useTheme } from "@/components/providers/theme-provider";

/**
 * Global reduce-motion switch (CLAUDE.md §2.4, §5). Complements the OS setting;
 * flipping it on halts every animation via the [data-reduce-motion] CSS rules.
 * Rendered with its caption in the `(immersive)` corner and the admin style
 * guide; the app nav carries the same switch as a menu item in `AccountMenu`.
 */
export function ReduceMotionToggle() {
  const { accountReduceMotion, setReduceMotion } = useTheme();
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-xs text-body">
      <input
        id={id}
        type="checkbox"
        checked={accountReduceMotion}
        onChange={(e) => setReduceMotion(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-primary"
      />
      <span>Reduce motion</span>
    </label>
  );
}
