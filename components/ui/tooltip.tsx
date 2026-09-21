"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { useDensityScope } from "./use-density-scope";

export type Side = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: React.ReactNode;
  side?: Side;
  /** The trigger. Must be a single focusable element (button, link…). */
  children: React.ReactElement;
}

/**
 * Tooltip primitive. Radix wires aria-describedby, opens on keyboard focus
 * (not only hover — CLAUDE.md §5), and positions with collision handling.
 * Never put interactive content in a tooltip; that is what Popover is for.
 */
export function Tooltip({ content, side = "top", children }: TooltipProps) {
  const { anchorRef, density } = useDensityScope();
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <span hidden ref={anchorRef} />
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            data-density={density}
            side={side}
            sideOffset={6}
            className="z-popover rounded-md bg-foreground px-xs py-2xs text-caption text-background shadow-overlay"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
