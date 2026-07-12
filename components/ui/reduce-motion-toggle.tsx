"use client";

import { useId } from "react";
import { useTheme } from "@/components/providers/theme-provider";

/**
 * Global reduce-motion switch (CLAUDE.md §2.4, §5). Complements the OS setting;
 * flipping it on halts every animation via the [data-reduce-motion] CSS rules.
 */
export function ReduceMotionToggle() {
  const { reduceMotion, setReduceMotion } = useTheme();
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={reduceMotion}
        onChange={(e) => setReduceMotion(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-primary"
      />
      Reduce motion
    </label>
  );
}
