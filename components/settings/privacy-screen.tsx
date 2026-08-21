"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { Container } from "@/components/ui/container";
import { DangerZone } from "./danger-zone";
import { DeleteDataDialog } from "./delete-data-dialog";
import { AiTrainingToggle } from "./ai-training-toggle";
import type { DeletionTier } from "@/lib/account-deletion/lifecycle";

export interface PrivacyScreenProps {
  /** Server-read (`getModelTrainingConsent`, page.tsx) — see AiTrainingToggle. */
  initialAiTrainingConsent: boolean;
}

/**
 * `337:3323`, the client half — holds only which dialog is open (and which
 * tier). The pending-deletion banner (Task 11) and the `pending` prop that
 * feeds it are deliberately NOT wired here: that task composes itself in
 * when it lands, rather than this file carrying an unused prop in
 * anticipation of it.
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
 */
export function PrivacyScreen({ initialAiTrainingConsent }: PrivacyScreenProps) {
  const t = useTranslations("settings");
  const [openTier, setOpenTier] = useState<DeletionTier | null>(null);

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

        <DangerZone
          onCloseAccount={() => setOpenTier("close_account")}
          onEraseAll={() => setOpenTier("erase_all")}
          memoryHref="/settings/privacy/memory"
        />

        <DeleteDataDialog
          open={openTier !== null}
          tier={openTier ?? "erase_all"}
          onClose={() => setOpenTier(null)}
          onConfirmed={() => setOpenTier(null)}
        />
      </div>
    </Container>
  );
}
