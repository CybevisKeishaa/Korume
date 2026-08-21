"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { Container } from "@/components/ui/container";
import { DangerZone } from "./danger-zone";
import { DeleteDataDialog } from "./delete-data-dialog";
import { AiTrainingToggle } from "./ai-training-toggle";

/**
 * `337:3323`, the client half — holds only which dialog is open. The
 * pending-deletion banner (Task 11) and the `pending` prop that feeds it are
 * deliberately NOT wired here: that task composes itself in when it lands,
 * rather than this file carrying an unused prop in anticipation of it.
 *
 * "Delete Account" (close_account) has no confirmation dialog in this unit.
 * `DeleteDataDialog`'s copy (`settings.deleteDialog.*`) is written for
 * `erase_all` specifically — it lists categories being erased and says
 * nothing survives — while `dangerZone.closeAccount.body` promises the
 * opposite ("Your learning data is kept, and you can come back"). Opening
 * that dialog for this row would misstate the consequence, so it routes to
 * the same kind of honest not-built destination the memory row's `Link`
 * already uses, rather than a dialog that would lie about what happens.
 */
export function PrivacyScreen() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [eraseAllOpen, setEraseAllOpen] = useState(false);

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

        <AiTrainingToggle />

        <DangerZone
          onCloseAccount={() => router.push("/settings/privacy/close-account")}
          onEraseAll={() => setEraseAllOpen(true)}
          memoryHref="/settings/privacy/memory"
        />

        <DeleteDataDialog
          open={eraseAllOpen}
          tier="erase_all"
          onClose={() => setEraseAllOpen(false)}
          onConfirmed={() => setEraseAllOpen(false)}
        />
      </div>
    </Container>
  );
}
