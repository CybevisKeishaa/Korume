"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A short, flat list of mutually exclusive choices (settings spec §4.4, §4.5).
 *
 * The WAI-ARIA radiogroup pattern: one tab stop for the whole group, arrows
 * move between options and select as they go. Radix is not used here — the
 * repo has no radio-group package, and the pattern is a dozen lines.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  "aria-label": ariaLabel,
  disabled = false,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  "aria-label": string;
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: number) => {
    const to = (from + step + options.length) % options.length;
    const option = options[to];
    if (!option) return;
    // Focus as well as select: the parent owns `value`, so a controlled
    // re-render is not guaranteed to move focus for us, and without this the
    // next arrow key would start from the old option.
    refs.current[to]?.focus();
    onValueChange(option.value);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    // ⚠️ Auto-repeat is ignored because every move here is a network write.
    // The OS repeats a held key ~30 times a second, and `WRITE_LIMIT` allows
    // 30 preference writes a MINUTE — so one second of a leaning finger used
    // to exhaust the budget and 429 every save for the rest of the minute.
    // This used to be masked: the first save rendered the group `disabled`,
    // which dropped focus, so the repeats reached nothing. Removing that
    // `disabled` fixed the focus bug and exposed this, so the throttle is now
    // explicit rather than a side effect of a control going dead.
    if (event.repeat) return;
    move(index, step);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex rounded-full border border-border bg-input-background p-2xs", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "h-control-sm rounded-full px-sm text-caption",
              "transition-colors duration-fast",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "bg-primary/15 text-primary-strong" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
