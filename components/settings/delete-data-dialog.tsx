"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import type { DeletionTier } from "@/lib/account-deletion/lifecycle";
import type { PendingDeletion } from "@/lib/data/account-deletion";
import { pendingDeletionResponseSchema } from "@/lib/validation/account-deletion";

const CATEGORY_KEYS = ["profile", "progress", "memory", "companion", "saved", "practice"] as const;

export interface DeleteDataDialogProps {
  open: boolean;
  tier: DeletionTier;
  onClose: () => void;
  onConfirmed: (pending: PendingDeletion) => void;
}

/**
 * `339:3612`, built structurally verbatim for BOTH deletion tiers — six
 * categories, PLEASE NOTE, typed confirmation plus checkbox, Keep/Confirm —
 * only the copy differs by `tier`, read from `settings.deleteDialog.${tier}`
 * (fix round 1, 2026-08-21): `erase_all` and `close_account` are complete,
 * independent copy blocks with identical key structure (guarded by
 * `messages/en/settings.pin.test.ts`'s "identical key structure" test), not
 * partial overrides. next-intl has no cross-tier fallback — a key missing
 * from one tier renders its own raw key path or throws, it does not borrow
 * the other tier's string — but a missing `close_account` key would still
 * be its own defect on a destructive-action surface (a raw literal like
 * `"deleteDialog.close_account.confirmBody"` next to a live "Close my
 * account" button), and the two-block shape exists so that never happens
 * quietly: `close_account`'s copy must independently say plainly that data
 * is KEPT (`dangerZone.closeAccount.body`'s promise: "Your learning data is
 * kept, and you can come back"), never inherit anything from `erase_all`.
 *
 * The frame says "cannot be undone" for the erase-all case; the LOCKED
 * lifecycle is cancelable for 7 days for BOTH tiers (spec §2). The words are
 * corrected; the sections are not.
 *
 * Composed on `components/ui/dialog.tsx`'s `Dialog` — a single controlled
 * component (title/description/children), not the `DialogContent`/
 * `DialogTitle`/`DialogDescription` compound API — so the eyebrow kicker
 * renders as the first child rather than literally above the dialog's own
 * heading (accepted on review: dropping `title` to control ordering would
 * forfeit the accessible name, and trading an a11y guarantee for pixel
 * order is the wrong trade). Focus trap, Escape-to-close and focus return
 * on close all come from that shared primitive; nothing here reimplements
 * them.
 *
 * `deleteDialog.support` (shared across tiers, reworded in fix round 2 to
 * drop its erase-specific framing — "you can request deletion of your
 * personal data" doesn't describe closing an account) is rendered as a
 * footer line rather than deleted: against "the frame's template is kept
 * verbatim," dropping a whole line the frame draws is a bigger structural
 * departure than any spacing/ordering call made elsewhere in this file.
 *
 * `open` remounts the whole dialog on every open and on every tier switch —
 * `key={openTier ?? "closed"}` lives on the `<DeleteDataDialog>` call site
 * in `privacy-screen.tsx`, not here, because `typed`/`acknowledged`/`error`/
 * `submitting` are local state on an ALWAYS-MOUNTED component (Radix stops
 * RENDERING children when `open` is false; it does not unmount them). Fix
 * round 2, Critical: without the `key`, a typed "DELETE" + ticked
 * acknowledgement from one tier survived an Escape and a reopen under the
 * OTHER tier, arming its confirm button with zero new input — see
 * `privacy-screen.test.tsx`'s "does not carry a typed confirmation across a
 * close and a tier switch" test for the mutation-checked proof.
 */
export function DeleteDataDialog({ open, tier, onClose, onConfirmed }: DeleteDataDialogProps) {
  const t = useTranslations("settings");
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();

  // Every tier-specific string reads through this prefix. `tier` is exactly
  // `DeletionTier`'s own literal values (`erase_all` | `close_account`),
  // which double as the copy-block key — one fact, one home (CLAUDE.md §6),
  // no separate tier→key mapping to keep in sync.
  const copy = `deleteDialog.${tier}` as const;

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
        // Branch on the STATUS CODE only — never start reading the body.
        // A status code is not server-supplied text; the moment this branch
        // called response.json() to look for a nicer message, the no-parse
        // discipline that makes the "never render a server string" guarantee
        // airtight would have a hole in it (CLAUDE.md §2/§6 — the exact
        // defect class L9a closed five times).
        //
        // 409/401 are not "try again" situations — retrying a request that
        // is already pending, or one whose session has expired, cannot
        // possibly succeed, so telling the user to retry is actively
        // harmful (there is no pending-state banner yet to tell them
        // otherwise; that is Task 11's). Every other status falls back to
        // the generic message.
        if (response.status === 409) setError(t("deleteDialog.alreadyPending"));
        else if (response.status === 401) setError(t("deleteDialog.signedOut"));
        else if (response.status === 429) setError(t("deleteDialog.tooMany"));
        else setError(t("deleteDialog.failed"));
        return;
      }
      // Validated, not cast (Task 11): this value now drives
      // DeletionPendingBanner's rendered date, so an unexpected shape must
      // never reach `onConfirmed` — see pendingDeletionResponseSchema's own
      // comment for why. A parse failure is treated the same as any other
      // "couldn't schedule the deletion" failure, not a distinct message:
      // from the user's perspective the request did not go through either
      // way.
      const json: unknown = await response.json();
      const parsed = pendingDeletionResponseSchema.safeParse(json);
      if (!parsed.success) {
        setError(t("deleteDialog.failed"));
        return;
      }
      onConfirmed(parsed.data.data);
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
      title={t(`${copy}.title`)}
      description={t(`${copy}.subtitle`)}
      closeLabel={t(`${copy}.keep`)}
      className="max-w-[42rem]"
    >
      <p className="text-caption uppercase tracking-wide text-accent-strong">{t(`${copy}.eyebrow`)}</p>

      <h3 className="mt-lg text-body font-semibold">{t(`${copy}.whatHeading`)}</h3>
      <ul className="mt-md divide-y divide-border">
        {CATEGORY_KEYS.map((key) => (
          <li key={key} data-testid="delete-category" className="py-sm">
            <p className="text-body">{t(`${copy}.items.${key}.title`)}</p>
            <p className="text-caption text-muted-foreground">{t(`${copy}.items.${key}.body`)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-lg rounded-md border border-danger/40 bg-danger/5 p-md">
        <p className="text-caption uppercase tracking-wide text-danger-strong">{t(`${copy}.noteLabel`)}</p>
        <p className="mt-xs text-caption text-muted-foreground">{t(`${copy}.note`)}</p>
      </div>

      <p className="mt-lg text-caption uppercase tracking-wide text-muted-foreground">
        {t(`${copy}.confirmLabel`)}
      </p>
      <h3 className="mt-xs text-heading font-bold">{t(`${copy}.confirmHeading`)}</h3>
      <p className="mt-xs text-caption text-muted-foreground">{t(`${copy}.confirmBody`)}</p>

      <label htmlFor={inputId} className="mt-md block text-caption">
        {t(`${copy}.typePrompt`)}
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
        {t(`${copy}.acknowledge`)}
      </label>

      {error ? (
        <p role="alert" className="mt-md text-caption text-danger-strong">
          {error}
        </p>
      ) : null}

      <div className="mt-lg flex items-center justify-end gap-sm">
        <button type="button" onClick={onClose} className="rounded-full bg-secondary px-lg py-sm text-caption">
          {t(`${copy}.keep`)}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => void submit()}
          className="rounded-full bg-danger px-lg py-sm text-caption font-semibold text-danger-foreground disabled:opacity-50"
        >
          {t(`${copy}.confirm`)}
        </button>
      </div>

      <p className="mt-md text-caption text-muted-foreground">{t("deleteDialog.support")}</p>
    </Dialog>
  );
}
