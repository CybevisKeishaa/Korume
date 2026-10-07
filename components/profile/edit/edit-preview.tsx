"use client";

import { useTranslations } from "@/lib/i18n";
import { CARD, CARD_WARM, EYEBROW } from "../card-styles";
import { IdentityCard, type ProfileIdentityModel } from "../identity-card";
import { wholeMonths } from "../korumeship-card";

/**
 * The live preview column (spec §8.2): the /profile identity component fed the unsaved draft, plus the frame's
 * Korume, goal and relationship cards. Presentational; the form owns every value.
 */
export function EditPreview({
  identity, interfaceLocale, companionEnabled, goal, since, onChangePhoto,
}: {
  identity: ProfileIdentityModel;
  interfaceLocale: string;
  companionEnabled: boolean;
  goal: string;
  since: string | null;
  onChangePhoto: () => void;
}) {
  const t = useTranslations("profile");
  return (
    <aside className="profile-edit-preview" aria-label={t("edit.previewEyebrow")}>
      <p className={`${EYEBROW} mb-xs`}>{t("edit.previewEyebrow")}</p>
      <IdentityCard identity={identity} variant="preview" interfaceLocale={interfaceLocale} onChangePhoto={onChangePhoto} />
      <div className="profile-edit-extra grid gap-md">
        {companionEnabled && (
          <section className={CARD_WARM} aria-labelledby="profile-edit-current-korume">
            <h2 id="profile-edit-current-korume" className={EYEBROW}>{t("edit.currentKorume.eyebrow")}</h2>
            <p className="mt-xs text-xl font-semibold">{t("edit.currentKorume.title")}</p>
            <p className="mt-2xs text-sm text-muted-foreground">{t("edit.currentKorume.body")}</p>
          </section>
        )}
        {goal && (
          <section className={CARD} aria-labelledby="profile-edit-goal-preview">
            <h2 id="profile-edit-goal-preview" className={EYEBROW}>{t("goal.eyebrow")}</h2>
            <blockquote className="mt-sm text-lg leading-relaxed [overflow-wrap:anywhere]">“{goal}”</blockquote>
          </section>
        )}
        {companionEnabled && (
          <section className={`${CARD} flex items-center justify-between gap-sm`} aria-labelledby="profile-edit-relationship">
            <div>
              <h2 id="profile-edit-relationship" className={EYEBROW}>{t("edit.relationship.eyebrow")}</h2>
              <p className="mt-xs text-lg font-semibold">{t("edit.relationship.title")}</p>
              <p className="mt-2xs text-sm text-muted-foreground">
                {since ? t("korume.together", { months: wholeMonths(since, identity.timeZone) }) : t("korume.fresh")}
              </p>
            </div>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-md shrink-0 text-primary" fill="currentColor">
              <path d="M12 20.6 4.6 13.3a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5L12 20.6Z" />
            </svg>
          </section>
        )}
      </div>
    </aside>
  );
}
