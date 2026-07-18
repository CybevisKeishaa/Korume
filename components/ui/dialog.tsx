"use client";

import { useLayoutEffect, useRef } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional supporting line under the title; wired to aria-describedby. */
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Element to focus when the dialog opens; defaults to the close button. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Accessible label for the × button. Feature code passes translated copy (P4). */
  closeLabel?: string;
}

/**
 * Modal dialog primitive. Radix supplies the parts hand-rolled modals get
 * wrong — focus trap (repays the L7 WCAG 2.4.3 debt), focus return to the
 * trigger, Escape + outside-click dismiss, scroll lock, portal — while the
 * API stays ours: controlled open/onClose, no Radix surface leaks (P8/D7).
 *
 * Centering uses left-1/2/-translate-x-1/2: genuinely physical geometry,
 * exempt from the §8 logical-properties rule.
 *
 * Two manual overrides vs. the installed @radix-ui/react-dialog@1.1.19
 * reality:
 *  - This version's DialogContent does not set `aria-modal` itself, so it is
 *    set explicitly here.
 *  - Radix's own onCloseAutoFocus only restores focus to a `RadixDialog.
 *    Trigger` — this API is a controlled open/onClose boolean with the
 *    trigger living outside the component (not a Radix Trigger), so it is
 *    never populated. Focus is captured on open (useLayoutEffect, so it runs
 *    before FocusScope's own mount effect steals it) and restored manually
 *    on close, overriding Radix's default (which would otherwise no-op).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  initialFocusRef,
  closeLabel = "Close dialog",
}: DialogProps) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-overlay bg-scrim/50" />
        <RadixDialog.Content
          aria-modal="true"
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previouslyFocusedRef.current?.focus();
          }}
          // Radix warns to console when Content has neither a Description nor
          // an explicit aria-describedby={undefined}; spread the opt-out only
          // when no description is given.
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed left-1/2 top-1/2 z-overlay max-h-[90vh] w-[calc(100%-2rem)] max-w-lg",
            "-translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border",
            "bg-overlay p-md text-foreground shadow-floating",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-xs">
            <RadixDialog.Title className="text-heading font-semibold">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label={closeLabel}
              className="shrink-0 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ×
            </RadixDialog.Close>
          </div>
          {description ? (
            <RadixDialog.Description className="mt-1 text-body text-muted-foreground">
              {description}
            </RadixDialog.Description>
          ) : null}
          <div className="mt-sm">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
