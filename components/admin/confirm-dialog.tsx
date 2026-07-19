"use client";

import { Dialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action (e.g. permanent
   * delete) — the reject-video flow uses this per the task's "confirm
   * destructively" requirement. */
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra form content rendered between the description and the buttons,
   * e.g. an optional "reason" textarea for video rejection. */
  children?: React.ReactNode;
}

/** Generic confirm/cancel dialog built on the shared `Dialog` primitive. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  busy,
  error,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  // This is a thin, client-side wrapper over the ui Dialog primitive, so it
  // translates its own closeLabel directly rather than asking every caller to
  // thread one through (P4) — the primitive still keeps its own English
  // fallback for any caller that renders <Dialog> without one.
  const t = useTranslations("common");

  return (
    <Dialog open={open} title={title} onClose={onCancel} closeLabel={t("a11y.closeDialog")}>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger-strong">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={destructive ? "outline" : "primary"}
          className={destructive ? "border-danger text-danger-strong hover:bg-danger/10" : undefined}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
