"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import type { Side } from "./tooltip";

export interface PopoverProps {
  /** The anchor/trigger. Must be a single focusable element. */
  trigger: React.ReactElement;
  /** Controlled open state; omit for uncontrolled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: Side;
  align?: "start" | "center" | "end";
  className?: string;
  children: React.ReactNode;
}

/**
 * Popover primitive: interactive floating content anchored to a trigger.
 * Radix supplies focus management, Escape/outside-click dismiss, positioning
 * with collision handling. The trigger is passed as a prop; `asChild` stays
 * an internal detail (P8).
 */
export function Popover({
  trigger,
  open,
  onOpenChange,
  side = "bottom",
  align = "center",
  className,
  children,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-popover rounded-md border border-border bg-overlay p-md text-foreground shadow-overlay",
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
