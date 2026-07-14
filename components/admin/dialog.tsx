"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Element to focus when the dialog opens; defaults to the built-in close
   * (×) button. */
  initialFocusRef?: React.RefObject<HTMLElement>;
}

/**
 * Minimal modal dialog primitive shared by every admin CMS dialog (reject
 * confirm, transcript attach, content create/edit). Follows the same
 * keyboard/focus contract as this repo's existing popover precedent
 * (`components/reading/word-lookup-popover.tsx`, `components/layout/notification-bell.tsx`):
 * Escape closes, opening moves focus into the dialog, and — being a true
 * modal rather than an inline popover — a click on the dimmed backdrop also
 * closes it. Returning focus to whatever triggered the dialog is the caller's
 * job (it owns the trigger ref); this component only manages focus *inside*
 * itself.
 *
 * Plain CSS/no animation: admin is not the cinematic surface (CLAUDE.md §5
 * scope, this task's brief) and respects `prefers-reduced-motion` by simply
 * not animating at all.
 */
export function Dialog({ open, title, onClose, children, className, initialFocusRef }: DialogProps) {
  const headingId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    (initialFocusRef?.current ?? closeButtonRef.current)?.focus();
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={cn(
          "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-lg",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id={headingId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ×
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
