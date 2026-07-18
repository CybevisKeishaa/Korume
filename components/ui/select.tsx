"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Pair with <Label htmlFor={id}>. */
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Select primitive. Radix supplies typeahead, keyboard navigation and the
 * listbox ARIA pattern. The API is a flat options array on purpose: nothing
 * compound to leak (P8), and every call site stays declarative.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-xs rounded-md border border-input",
          "bg-card px-sm text-body text-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[placeholder]:text-muted-foreground",
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon aria-hidden="true" className="text-muted-foreground">
          ▾
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-popover max-h-72 min-w-[--radix-select-trigger-width] overflow-y-auto",
            "rounded-md border border-border bg-overlay shadow-overlay",
          )}
        >
          <RadixSelect.Viewport className="p-2xs">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "flex cursor-default select-none items-center justify-between gap-xs rounded-sm",
                  "px-sm py-2xs text-body text-foreground outline-none",
                  "data-[highlighted]:bg-muted data-[disabled]:opacity-50",
                )}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator aria-hidden="true">✓</RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
