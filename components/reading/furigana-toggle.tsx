"use client";

import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface FuriganaToggleProps {
  pressed: boolean;
  onToggle: () => void;
  /** True when the passage has no furigana data to show (generation failed). */
  disabled?: boolean;
  className?: string;
}

/**
 * Real toggle button (never a styled `<div>`) for showing/hiding furigana
 * over the reading passage body. `aria-pressed` carries the state so it
 * never relies on color alone (CLAUDE.md §5); the label text itself also
 * changes so the state is legible without any styling at all.
 */
export function FuriganaToggle({ pressed, onToggle, disabled, className }: FuriganaToggleProps) {
  const t = useTranslations("reading");
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      title={disabled ? t("furigana.unavailableTitle") : undefined}
      className={cn(
        "rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors",
        pressed
          ? "bg-primary text-primary-foreground"
          : "bg-transparent text-foreground hover:bg-secondary",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {disabled ? t("furigana.unavailable") : pressed ? t("furigana.hide") : t("furigana.show")}
    </button>
  );
}
