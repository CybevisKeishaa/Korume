"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { Container } from "@/components/ui/container";
import { DangerZone } from "./danger-zone";
import { DeleteDataDialog } from "./delete-data-dialog";
import { DeletionPendingBanner } from "./deletion-pending-banner";
import { AiTrainingToggle } from "./ai-training-toggle";
import type { DeletionTier } from "@/lib/account-deletion/lifecycle";
import type { PendingDeletionRead } from "@/lib/data/account-deletion";
import { getPendingDeletionResponseSchema } from "@/lib/validation/account-deletion";

export interface PrivacyScreenProps {
  /** Server-read (`getModelTrainingConsent`, page.tsx) — see AiTrainingToggle. */
  initialAiTrainingConsent: boolean;
  /**
   * Server-read (`getPendingDeletion`, page.tsx) — the live deletion
   * request for this user, if any, at the moment the page rendered. `null`
   * means genuinely no request; `"unknown"` (fix round 1, Important #3(b))
   * means the read failed and the true state could not be determined — these
   * are never conflated, because during the 7-day cancellation window
   * telling a user "no request" when the truth is "we don't know" is the
   * dangerous direction to be wrong in. Kept as its own piece of state below
   * (not just read once) so a fresh POST, a cancel, or a `refreshPending()`
   * re-sync updates the screen without a reload — Task 11 / fix round 1.
   */
  pending: PendingDeletionRead;
}

/**
 * `337:3323`, the client half — holds which dialog is open (and which
 * tier), plus the pending-deletion request (Task 11's `pending` state,
 * seeded from the server prop of the same name).
 *
 * Both Danger Zone rows that need confirmation ("Delete Account" and
 * "Delete all my data") open the SAME `DeleteDataDialog`, distinguished only
 * by `tier` — fix round 1 (2026-08-21). `DeleteDataDialog`'s copy is a
 * complete, independent block per tier (`settings.deleteDialog.erase_all` /
 * `.close_account`), so `close_account` never shows erase-all's "will be
 * deleted" wording; it says plainly that learning data is kept, matching
 * `dangerZone.closeAccount.body`'s promise ("Your learning data is kept, and
 * you can come back"). Only the memory row still points at an honest
 * not-built destination — that feature genuinely has no confirmation flow
 * anywhere in this branch.
 *
 * `key={openTier ?? "closed"}` on `<DeleteDataDialog>` below is load-bearing
 * — fix round 2, Critical. `DeleteDataDialog` is mounted unconditionally and
 * merely hidden by `open`, so its `typed`/`acknowledged`/`error`/
 * `submitting` state lives on an always-mounted component (Radix stops
 * RENDERING children when closed; it does not unmount them). Without the
 * `key`, typing "DELETE" and ticking the box under one tier, then pressing
 * Escape and opening the OTHER tier, left the confirm button already
 * ENABLED under an acknowledgement the user never gave for that action —
 * the confirmation gate's only purpose is to require fresh input for THIS
 * specific destructive action, and shared state across tiers defeats that
 * outright. The `key` forces a fresh mount (and therefore fresh state) on
 * every open and every tier switch; it is the hardest version of this fix
 * to regress, because it does not depend on remembering to reset four
 * separate fields by hand.
 *
 * Task 11: an actual pending request (not `null`, and not fix round 1's
 * `"unknown"` — see `PrivacyScreenProps.pending`) is threaded into
 * `DangerZone`'s `pendingRequest` prop, disabling both destructive rows —
 * the `account_deletion_requests` table allows only one live request per
 * user, so re-opening either dialog while one exists can only produce the
 * 409 the API already refuses. The banner (rendered above the Danger Zone
 * whenever `pending` is a real request) is what tells the user why, in
 * tier-aware copy (fix round 1, Important #1) that also explains how to
 * switch to the other kind of request (Important #2). `onConfirmed` receives
 * the newly-created `PendingDeletion` straight from `DeleteDataDialog` —
 * already validated at that boundary (see its own file) — and sets it
 * directly, so the banner appears with no reload and no extra round trip.
 * `refreshPending()` (this file's own function, passed down to both
 * `DeleteDataDialog` and `DeletionPendingBanner`) is the single re-sync path
 * for every case where a child's belief about pending-state might be wrong.
 */
export function PrivacyScreen({ initialAiTrainingConsent, pending: initialPending }: PrivacyScreenProps) {
  const t = useTranslations("settings");
  const [openTier, setOpenTier] = useState<DeletionTier | null>(null);
  const [pending, setPending] = useState<PendingDeletionRead>(initialPending);

  /**
   * The ONE re-sync mechanism fix round 1 (2026-08-21) builds for every path
   * where a child's belief about pending-state is known to be wrong or
   * unknown — the dialog's `409` branch, the dialog's malformed/wrong-tier
   * `200` branch, and the banner's cancel `404` branch all call this, rather
   * than three separate ad hoc re-fetches. Validates the body the same way
   * the POST success path already does (`pendingDeletionResponseSchema`'s
   * sibling `getPendingDeletionResponseSchema`) — an unvalidated GET response
   * must not drive this page's rendered state any more than an unvalidated
   * POST response may. A failed fetch, a non-OK status, or a parse failure
   * all land on `"unknown"`: the read did not confirm anything, so the state
   * that reflects that honestly is "we don't know", not a guess in either
   * direction.
   */
  async function refreshPending(): Promise<void> {
    try {
      const response = await fetch("/api/user/deletion");
      if (!response.ok) {
        setPending("unknown");
        return;
      }
      const json: unknown = await response.json();
      const parsed = getPendingDeletionResponseSchema.safeParse(json);
      if (!parsed.success) {
        setPending("unknown");
        return;
      }
      setPending(parsed.data.data);
    } catch {
      setPending("unknown");
    }
  }

  // A transient read failure ("unknown") must not lock a user out of the
  // GDPR right this page exists to serve — only an actual, confirmed pending
  // request disables the Danger Zone rows (Important #3(b)).
  const pendingRequest = pending !== null && pending !== "unknown";

  return (
    <Container className="py-3xl">
      <div className="max-w-[60ch]">
        <nav aria-label={t("privacy.breadcrumbPrivacy")} className="text-caption text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground">
            {t("privacy.breadcrumbSettings")}
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{t("privacy.breadcrumbPrivacy")}</span>
        </nav>

        <p className="mt-lg text-caption font-semibold uppercase tracking-wide text-accent-strong">
          {t("privacy.eyebrow")}
        </p>
        <h1 className="mt-xs text-title font-bold">{t("privacy.title")}</h1>
        <p className="mt-xs text-body text-muted-foreground">{t("privacy.subtitle")}</p>

        <AiTrainingToggle initialConsent={initialAiTrainingConsent} />

        {pending === "unknown" ? (
          // No new visual vocabulary (Important #3(b)'s cap): the same
          // neutral card language `AiTrainingToggle` already uses on this
          // screen, not the danger-tinted banner styling below.
          <div role="status" className="mt-xl rounded-lg border border-border bg-card p-lg">
            <p className="text-body font-semibold">{t("privacy.checkFailedTitle")}</p>
            <p className="mt-xs text-caption text-muted-foreground">{t("privacy.checkFailedBody")}</p>
          </div>
        ) : pending ? (
          <div className="mt-xl">
            <DeletionPendingBanner
              pending={pending}
              onCancelled={() => setPending(null)}
              refreshPending={refreshPending}
            />
          </div>
        ) : null}

        <DangerZone
          onCloseAccount={() => setOpenTier("close_account")}
          onEraseAll={() => setOpenTier("erase_all")}
          memoryHref="/settings/privacy/memory"
          pendingRequest={pendingRequest}
        />

        <DeleteDataDialog
          key={openTier ?? "closed"}
          open={openTier !== null}
          tier={openTier ?? "erase_all"}
          onClose={() => setOpenTier(null)}
          onConfirmed={(confirmed) => {
            setPending(confirmed);
            setOpenTier(null);
          }}
          refreshPending={refreshPending}
        />
      </div>
    </Container>
  );
}
