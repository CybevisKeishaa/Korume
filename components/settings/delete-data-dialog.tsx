"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import type { DeletionTier } from "@/lib/account-deletion/lifecycle";
import type { PendingDeletion } from "@/lib/data/account-deletion";

const CATEGORY_KEYS = ["profile", "progress", "memory", "companion", "saved", "practice"] as const;

export interface DeleteDataDialogProps {
  open: boolean;
  tier: DeletionTier;
  onClose: () => void;
  onConfirmed: (pending: PendingDeletion) => void;
}

/**
 * `339:3612`, built structurally verbatim — six categories, PLEASE NOTE,
 * typed confirmation plus checkbox, Keep my data / Delete all my data. One
 * thing changes: the frame says "cannot be undone", and the LOCKED lifecycle
 * is cancelable for 7 days (spec §2). The words are corrected; the sections
 * are not.
 *
 * Composed on `components/ui/dialog.tsx`'s `Dialog` — a single controlled
 * component (title/description/children), not the `DialogContent`/
 * `DialogTitle`/`DialogDescription` compound API — so the eyebrow kicker
 * renders as the first child rather than literally above the dialog's own
 * heading. Focus trap, Escape-to-close and focus return on close all come
 * from that shared primitive; nothing here reimplements them.
 */
export function DeleteDataDialog({ open, tier, onClose, onConfirmed }: DeleteDataDialogProps) {
  const t = useTranslations("settings");
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();

  const ready = typed === "DELETE" && acknowledged && !submitting;

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/user/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The API re-validates both of these. This is the same control
        // twice, on purpose: the client half is UX, the server half is the
        // control.
        body: JSON.stringify({ tier, confirmation: "DELETE", acknowledged: true }),
      });
      if (!response.ok) {
        // The server's own message never reaches the DOM (CLAUDE.md §2/§6 —
        // the exact defect class L9a closed five times: a raw server string
        // reaching a role="alert" node).
        setError(t("deleteDialog.failed"));
        return;
      }
      // Trusts the same-origin API's documented response shape without
      // runtime validation, matching this codebase's other client fetches
      // (e.g. components/video-player/pin-line-control.tsx).
      const body = (await response.json()) as { data: PendingDeletion };
      onConfirmed(body.data);
    } catch {
      setError(t("deleteDialog.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("deleteDialog.title")}
      description={t("deleteDialog.subtitle")}
      closeLabel={t("deleteDialog.keep")}
      className="max-w-[42rem]"
    >
      <p className="text-caption uppercase tracking-wide text-accent-strong">{t("deleteDialog.eyebrow")}</p>

      <h3 className="mt-lg text-body font-semibold">{t("deleteDialog.whatHeading")}</h3>
      <ul className="mt-md divide-y divide-border">
        {CATEGORY_KEYS.map((key) => (
          <li key={key} data-testid="delete-category" className="py-sm">
            <p className="text-body">{t(`deleteDialog.items.${key}.title`)}</p>
            <p className="text-caption text-muted-foreground">{t(`deleteDialog.items.${key}.body`)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-lg rounded-md border border-danger/40 bg-danger/5 p-md">
        <p className="text-caption uppercase tracking-wide text-danger-strong">{t("deleteDialog.noteLabel")}</p>
        <p className="mt-xs text-caption text-muted-foreground">{t("deleteDialog.note")}</p>
      </div>

      <p className="mt-lg text-caption uppercase tracking-wide text-muted-foreground">
        {t("deleteDialog.confirmLabel")}
      </p>
      <h3 className="mt-xs text-heading font-bold">{t("deleteDialog.confirmHeading")}</h3>
      <p className="mt-xs text-caption text-muted-foreground">{t("deleteDialog.confirmBody")}</p>

      <label htmlFor={inputId} className="mt-md block text-caption">
        {t("deleteDialog.typePrompt")}
      </label>
      <input
        id={inputId}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="mt-xs w-full rounded-full border border-border bg-transparent px-md py-sm"
        autoComplete="off"
      />

      <label className="mt-md flex items-center gap-sm text-caption">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        {t("deleteDialog.acknowledge")}
      </label>

      {error ? (
        <p role="alert" className="mt-md text-caption text-danger-strong">
          {error}
        </p>
      ) : null}

      <div className="mt-lg flex items-center justify-end gap-sm">
        <button type="button" onClick={onClose} className="rounded-full bg-secondary px-lg py-sm text-caption">
          {t("deleteDialog.keep")}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => void submit()}
          className="rounded-full bg-danger px-lg py-sm text-caption font-semibold text-danger-foreground disabled:opacity-50"
        >
          {t("deleteDialog.confirm")}
        </button>
      </div>
    </Dialog>
  );
}
