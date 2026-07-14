"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ConfirmButtonProps {
  /** Visible label of the plain (unconfirmed) button. */
  label: string;
  /** Text shown next to Yes/Cancel while confirming, e.g. "Really delete? This can't be undone." */
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "danger";
}

/**
 * Inline destructive-action confirmation (delete post/comment/playlist,
 * revoke a peer-review share). Deliberately not a modal dialog — the confirm
 * step replaces the button in place, which keeps focus management trivial:
 * Escape or Cancel returns focus to the original trigger, matching the
 * Escape-returns-focus convention used by this repo's popovers
 * (`components/layout/notification-bell.tsx`, `components/reading/word-lookup-popover.tsx`).
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  className,
  variant = "danger",
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  // The confirm step is a different element tree (not just a hidden one), so
  // the trigger `<button>` unmounts while confirming and remounts once it
  // ends — the new node isn't in the DOM yet at the moment Escape/Cancel is
  // handled. Defer the refocus to an effect that runs after that remount.
  const shouldRefocusTriggerRef = useRef(false);

  useEffect(() => {
    if (confirming) yesRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (!confirming && shouldRefocusTriggerRef.current) {
      shouldRefocusTriggerRef.current = false;
      triggerRef.current?.focus();
    }
  }, [confirming]);

  useEffect(() => {
    if (!confirming) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        shouldRefocusTriggerRef.current = true;
        setConfirming(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  function cancel(): void {
    shouldRefocusTriggerRef.current = true;
    setConfirming(false);
  }

  if (confirming) {
    return (
      <span role="group" aria-label={confirmLabel} className={cn("inline-flex items-center gap-2", className)}>
        <span className="text-xs text-muted-foreground">{confirmLabel}</span>
        <button
          ref={yesRef}
          type="button"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          className="rounded-md bg-danger px-2 py-1 text-xs font-medium text-white hover:bg-danger/90"
        >
          Yes, {label.toLowerCase()}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      onClick={() => setConfirming(true)}
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium disabled:pointer-events-none disabled:opacity-50",
        variant === "danger"
          ? "text-danger hover:bg-danger/10"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {label}
    </button>
  );
}
