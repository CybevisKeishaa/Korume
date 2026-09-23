"use client";

import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { Container } from "@/components/ui/container";
import { AiTrainingToggle } from "./ai-training-toggle";
import { DeletionControls } from "./deletion-controls";
import type { PendingDeletionRead } from "@/lib/data/account-deletion";

export interface PrivacyScreenProps {
  /** Server-read (`getModelTrainingConsent`, page.tsx) — see AiTrainingToggle. */
  initialAiTrainingConsent: boolean;
  pending: PendingDeletionRead;
}
export function PrivacyScreen({ initialAiTrainingConsent, pending }: PrivacyScreenProps) {
  const t = useTranslations("settings");

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
        <DeletionControls initialPending={pending} />
      </div>
    </Container>
  );
}
