"use client";

import { useId } from "react";
import { useTheme } from "@/components/providers/theme-provider";

/**
 * Global reduce-motion switch (CLAUDE.md §2.4, §5). Complements the OS setting;
 * flipping it on halts every animation via the [data-reduce-motion] CSS rules.
 *
 * `compact` (final whole-branch review NB-1, 2026-08-07): renders the visible
 * "Reduce motion" words `sr-only` instead of on-screen — the accessible name
 * (and the `<label>`/`<input>` association it comes from) is unchanged, only
 * the caption's visual presence is removed. `app-nav.tsx`'s edge-chrome rail
 * needs this: `(focus)` exists specifically so navigation recedes to a
 * narrow strip during focused study, and a captioned checkbox widened that
 * rail from 24px to ~130px, defeating the contract F1 was supposed to
 * preserve. The default (uncompact) rendering is unchanged for the
 * `(immersive)` corner and the admin style guide, where there's room and the
 * caption documents the control instead of fighting a width budget.
 */
export function ReduceMotionToggle({ compact = false }: { compact?: boolean }) {
  const { reduceMotion, setReduceMotion } = useTheme();
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-xs text-body">
      <input
        id={id}
        type="checkbox"
        checked={reduceMotion}
        onChange={(e) => setReduceMotion(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-primary"
      />
      <span className={compact ? "sr-only" : undefined}>Reduce motion</span>
    </label>
  );
}
