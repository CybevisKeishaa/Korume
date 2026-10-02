"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import type { Side } from "./tooltip";
import { useDensityScope } from "./use-density-scope";

export interface PopoverProps {
  /** The anchor/trigger. Must be a single focusable element. */
  trigger: React.ReactElement;
  /** Controlled open state; omit for uncontrolled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: Side;
  align?: "start" | "center" | "end";
  className?: string;
  /** Accessible name for the interactive popover content. */
  label?: string;
  /** Radix's Escape dismiss; `event.preventDefault()` keeps the popover open (e.g. a nested panel owns this Escape). */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Radix's focus-on-open; `event.preventDefault()` leaves focus where it was (content that holds no control). */
  onOpenAutoFocus?: (event: Event) => void;
  /** Radix's return-focus-on-close; `event.preventDefault()` leaves focus where the learner left it. */
  onCloseAutoFocus?: (event: Event) => void;
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
  label,
  onEscapeKeyDown,
  onOpenAutoFocus,
  onCloseAutoFocus,
  children,
}: PopoverProps) {
  const { anchorRef, contentRef } = useDensityScope();
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <span hidden ref={anchorRef} />
      <RadixPopover.Portal>
        <RadixPopover.Content
          ref={contentRef}
          side={side}
          align={align}
          sideOffset={6}
          aria-label={label}
          onEscapeKeyDown={onEscapeKeyDown}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "motion-popover z-popover rounded-md border border-border bg-overlay p-md text-foreground shadow-overlay",
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export interface AnchoredPopoverProps {
  /** The box to float next to — a text selection has no element to be a trigger. */
  anchor: DOMRect;
  onClose(): void;
  side?: Side;
  align?: "start" | "center" | "end";
  className?: string;
  label: string;
  /** Receives the content element (or null), e.g. to tell clicks inside it from clicks outside. */
  contentRef?: (node: HTMLDivElement | null) => void;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  children: React.ReactNode;
  [dataAttribute: `data-${string}`]: string | undefined;
}

/**
 * A non-modal popover anchored to a rectangle instead of a trigger (a text selection). Open while mounted;
 * Escape and an outside click call `onClose`. Same surface, density scope and motion as `Popover`.
 */
export function AnchoredPopover({
  anchor, onClose, side = "bottom", align = "start", className, label, contentRef: onContent, onOpenAutoFocus, onCloseAutoFocus, children, ...data
}: AnchoredPopoverProps) {
  const { anchorRef, contentRef } = useDensityScope();
  const virtualRef = { current: { getBoundingClientRect: () => anchor } };
  return (
    <RadixPopover.Root open modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <RadixPopover.Anchor virtualRef={virtualRef} />
      <span hidden ref={anchorRef} />
      <RadixPopover.Portal>
        <RadixPopover.Content
          ref={(node) => { contentRef(node); onContent?.(node); }}
          side={side}
          align={align}
          sideOffset={6}
          aria-label={label}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          {...data}
          className={cn("motion-popover z-popover rounded-md border border-border bg-overlay p-md text-foreground shadow-overlay", className)}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
