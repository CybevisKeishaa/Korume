"use client";

import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { Container } from "@/components/ui/container";
import { MascotPose } from "@/components/mascot/mascot-pose";
import type { PendingDeletionRead } from "@/lib/data/account-deletion";
import { SettingsSection } from "./settings-section";
import { SettingsRow } from "./settings-row";
import { LearningSection } from "./learning-section";
import { AppearanceSection } from "./appearance-section";
import { PrivacyDataSection } from "./privacy-data-section";
import { DeletionControls } from "./deletion-controls";

export interface SettingsPageProps {
  /** Server-read (`getModelTrainingConsent`) — see `AiTrainingToggle`. */
  initialAiTrainingConsent: boolean;
  /** Server-read (`readPendingDeletionSafe`) — see `DeletionControls`. */
  pending: PendingDeletionRead;
  /** `package.json`'s `version`, read server-side. */
  version: string;
}

/**
 * Figma Global settings `220:16032`.
 *
 * The control values are NOT props: `PreferencesProvider` is mounted in the
 * `(protected)` layout and already holds the user's preferences for the whole
 * session, so every section reads them from there. Passing them down again
 * would create a second copy that the save hook's optimistic updates would
 * immediately disagree with.
 *
 * Rows the frame draws that this page does NOT ship, each for a recorded
 * reason rather than an oversight — Study Reminder Time and the whole
 * Learning Reminders section (the `study-reminders` branch, spec §10), Theme
 * and Accent Color (spec §1.3), and the six About rows plus Contact Support
 * that have no destination in this repo (spec §1.7). A row that goes nowhere
 * is worse than an absent row: it looks finished.
 */
export function SettingsPage({ initialAiTrainingConsent, pending, version }: SettingsPageProps) {
  const t = useTranslations("settings");

  return (
    <Container className="py-3xl">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-lg">
          <div className="min-w-0">
            <p className="text-caption font-semibold uppercase tracking-wide text-accent-strong">
              {t("page.eyebrow")}
            </p>
            <h1 className="mt-xs text-title font-bold">{t("page.title")}</h1>
            <p className="mt-xs text-body text-muted-foreground">{t("page.subtitle")}</p>
          </div>
          <MascotPose pose="settings" size="sm" className="shrink-0" />
        </header>

        <LearningSection />
        <AppearanceSection />
        <PrivacyDataSection initialAiTrainingConsent={initialAiTrainingConsent} />

        {/* The same Danger Zone `/settings/privacy` shows — one component, so
            the two pages cannot drift apart on a destructive surface. */}
        <DeletionControls initialPending={pending} />

        <SettingsSection title={t("page.about.title")} subtitle={t("page.about.subtitle")}>
          <SettingsRow
            icon="history"
            label={t("page.about.versionLabel")}
            description={t("page.about.versionDescription")}
            control={<span className="text-caption text-muted-foreground">{version}</span>}
          />
        </SettingsSection>

        <section className="mt-xl rounded-lg border border-border bg-card p-lg">
          <h2 className="text-body-lg font-semibold">{t("page.support.title")}</h2>
          <p className="mt-2xs text-caption text-muted-foreground">{t("page.support.body")}</p>
          <Link
            href="/sensei"
            className="mt-md inline-flex h-control-md items-center rounded-full bg-primary px-lg text-caption font-semibold text-primary-foreground"
          >
            {t("page.support.action")}
          </Link>
        </section>

        <footer className="mt-xl text-center text-caption text-muted-foreground">
          <p>{t("page.footer.line", { version })}</p>
          <p className="mt-2xs">{t("page.footer.tagline")}</p>
        </footer>
      </div>
    </Container>
  );
}
