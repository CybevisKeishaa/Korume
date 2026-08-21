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
import type { PendingDeletion } from "@/lib/data/account-deletion";

export interface PrivacyScreenProps {
  /** Server-read (`getModelTrainingConsent`, page.tsx) — see AiTrainingToggle. */
  initialAiTrainingConsent: boolean;
  /**
   * Server-read (`getPendingDeletion`, page.tsx) — the live deletion
   * request for this user, if any, at the moment the page rendered. Null
   * when there is none, including when the read failed and page.tsx fell
   * back closed (see that file). Kept as its own piece of state below (not
   * just read once) so a fresh POST or a cancel updates the screen without
   * a reload or a re-fetch — Task 11.
   */
  pending: PendingDeletion | null;
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
 * Task 11: `pending !== null` is threaded into `DangerZone`'s
 * `pendingRequest` prop, disabling both destructive rows — the
 * `account_deletion_requests` table allows only one live request per user,
 * so re-opening either dialog while one exists can only produce the 409 the
 * API already refuses. The banner (rendered above the Danger Zone whenever
 * `pending` is set) is what tells the user why. `onConfirmed` receives the
 * newly-created `PendingDeletion` straight from `DeleteDataDialog` — already
 * validated at that boundary (see its own file) — and sets it directly, so
 * the banner appears with no reload and no extra round trip.
 */
export function PrivacyScreen({ initialAiTrainingConsent, pending: initialPending }: PrivacyScreenProps) {
  const t = useTranslations("settings");
  const [openTier, setOpenTier] = useState<DeletionTier | null>(null);
  const [pending, setPending] = useState<PendingDeletion | null>(initialPending);

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

        {pending ? (
          <div className="mt-xl">
            <DeletionPendingBanner pending={pending} onCancelled={() => setPending(null)} />
          </div>
        ) : null}

        <DangerZone
          onCloseAccount={() => setOpenTier("close_account")}
          onEraseAll={() => setOpenTier("erase_all")}
          memoryHref="/settings/privacy/memory"
          pendingRequest={pending !== null}
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
        />
      </div>
    </Container>
  );
}
