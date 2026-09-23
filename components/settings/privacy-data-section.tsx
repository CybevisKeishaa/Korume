"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { usePreferences } from "@/components/providers/preferences-provider";
import { SettingsSection } from "./settings-section";
import { SettingsRow } from "./settings-row";
import { usePreferenceSave } from "./use-preference-save";

/**
 * Privacy & Data (spec §2) — all five rows the frame draws.
 *
 * `id="privacy"` is the anchor the Danger Zone and the memory-erase page both
 * return the reader to.
 *
 * AI Training is NOT a `user_preferences` column — it lives on
 * `users.model_training_consent` behind its own route — so it runs through
 * `usePreferenceSave` with an endpoint override rather than a second
 * hand-rolled save path. It gets the same sequencing and the same rollback,
 * which matters more here than anywhere else on the page: this is the CLAUDE.md
 * §2 rule 2 consent flag, and a UI that settles on the wrong value could leave
 * someone believing they opted out when they opted in.
 *
 * Its optimistic state is local rather than in `PreferencesProvider`, because
 * the provider's shape is `user_preferences` and this value is not one of
 * them. The hook writes through `setLocal`, so the one key it owns is carried
 * in a `Partial<UserPreferences>`-shaped patch that the provider ignores —
 * hence the separate `useState` and the explicit rollback below.
 */
export function PrivacyDataSection({ initialAiTrainingConsent }: { initialAiTrainingConsent: boolean }) {
  const t = useTranslations("settings");
  const { preferences } = usePreferences();
  const microphone = usePreferenceSave("microphoneEnabled");
  const camera = usePreferenceSave("cameraEnabled");

  const micId = useId();
  const cameraId = useId();
  const aiId = useId();

  return (
    <SettingsSection
      id="privacy"
      title={t("page.privacy.title")}
      subtitle={t("page.privacy.subtitle")}
    >
      <SettingsRow
        icon="microphone"
        label={t("page.microphone.label")}
        description={t("page.microphone.description")}
        htmlFor={micId}
        control={
          <Switch
            id={micId}
            checked={preferences.microphoneEnabled}
            onCheckedChange={(checked) =>
              void microphone.save({ microphoneEnabled: checked }, { microphoneEnabled: checked })
            }
            disabled={microphone.saving}
          />
        }
      />

      <SettingsRow
        icon="camera"
        label={t("page.camera.label")}
        description={t("page.camera.description")}
        htmlFor={cameraId}
        control={
          <Switch
            id={cameraId}
            checked={preferences.cameraEnabled}
            onCheckedChange={(checked) =>
              void camera.save({ cameraEnabled: checked }, { cameraEnabled: checked })
            }
            disabled={camera.saving}
          />
        }
      />

      <AiTrainingRow id={aiId} initialConsent={initialAiTrainingConsent} />

      <DownloadRow
        icon="export"
        label={t("page.exportData.label")}
        description={t("page.exportData.description")}
        action={t("page.exportData.action")}
        href="/api/user/export"
      />

      <DownloadRow
        icon="history"
        label={t("page.history.label")}
        description={t("page.history.description")}
        action={t("page.history.action")}
        href="/api/user/history.csv"
      />
    </SettingsSection>
  );
}

/**
 * Its own component so its consent state is local to the one row that owns it,
 * and so the endpoint override lives next to the thing that needs it.
 */
function AiTrainingRow({ id, initialConsent }: { id: string; initialConsent: boolean }) {
  const t = useTranslations("settings");
  const [consent, setConsent] = useState(initialConsent);
  const save = usePreferenceSave("aiTraining", "/api/user/model-training-consent");

  return (
    <SettingsRow
      icon="training"
      // The existing `aiTraining` copy, not a second home for the same claim:
      // `messages/settings.pin.test.ts` pins this wording for naming the toggle
      // after what it actually covers, and duplicating it under `page.*` would
      // put the pinned sentence and an unpinned copy of it on the same screen.
      label={t("aiTraining.title")}
      description={t("aiTraining.body")}
      htmlFor={id}
      control={
        <Switch
          id={id}
          checked={consent}
          onCheckedChange={(checked) => {
            const previous = consent;
            setConsent(checked);
            // The hook owns the toast, the sequencing and the rollback of
            // anything in `UserPreferences`. `consent` is not in there, so
            // this row puts its own value back — and reads the RESULT to do
            // it, because `save` resolves rather than rejects on failure.
            void save.save({ consent: checked }, {}).then((ok) => {
              if (!ok) setConsent(previous);
            });
          }}
          disabled={save.saving}
        />
      }
    />
  );
}

/**
 * Export Data and Download Learning History. Both are plain `<a download>`, not
 * fetch-and-blob: the browser's own download is what handles a large file, a
 * slow response and a `Content-Disposition` filename, and a 401 lands the user
 * on a real page rather than in a silent JS failure.
 */
function DownloadRow({
  icon,
  label,
  description,
  action,
  href,
}: {
  icon: "export" | "history";
  label: string;
  description: string;
  action: string;
  href: string;
}) {
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      control={
        <a
          href={href}
          download
          className="inline-flex h-control-sm items-center rounded-full bg-secondary px-md text-caption"
        >
          {action}
        </a>
      }
    />
  );
}
