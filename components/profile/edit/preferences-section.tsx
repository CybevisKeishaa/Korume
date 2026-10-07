"use client";

import { useId } from "react";
import { useTranslations } from "@/lib/i18n";
import { LOCALE_ENDONYMS, routing, type Locale } from "@/lib/i18n/routing";
import { Select } from "@/components/ui/select";
import { READING_FURIGANA_OPTIONS, READING_TRANSLATION_OPTIONS } from "@/lib/preferences/options";
import { PREFERRED_PRACTICES } from "@/lib/profile/practices";
import { orderedPractices, type Draft } from "./draft";
import { Field, fieldId } from "./field";

/** Learning preferences (spec §8.3). The same four-value vocabularies `/settings` writes (R5). */
export function PreferencesSection({ draft, set }: { draft: Draft; set: (patch: Partial<Draft>) => void }) {
  const t = useTranslations("profile");
  const practiceLabel = useId();
  const toggle = (code: string) =>
    set({
      preferredPractices: orderedPractices(
        draft.preferredPractices.includes(code)
          ? draft.preferredPractices.filter((c) => c !== code)
          : [...draft.preferredPractices, code],
      ),
    });

  return (
    <section aria-labelledby="profile-edit-preferences" className="grid gap-sm border-t border-border pt-md">
      <h2 id="profile-edit-preferences" className="text-body-lg font-semibold">{t("edit.sections.preferences")}</h2>
      <div className="profile-edit-fields">
        <Field name="locale" label={t("edit.fields.interfaceLanguage")}>
          <Select
            id={fieldId("locale")}
            aria-label={t("edit.fields.interfaceLanguage")}
            value={draft.locale}
            onValueChange={(locale) => set({ locale: locale as Locale })}
            options={routing.locales.map((value) => ({ value, label: LOCALE_ENDONYMS[value] }))}
          />
        </Field>
        <Field name="readingTranslation" label={t("edit.fields.subtitleStyle")}>
          <Select
            id={fieldId("readingTranslation")}
            aria-label={t("edit.fields.subtitleStyle")}
            value={draft.readingTranslation}
            onValueChange={(readingTranslation) => set({ readingTranslation: readingTranslation as Draft["readingTranslation"] })}
            options={READING_TRANSLATION_OPTIONS.map((value) => ({ value, label: t(`edit.subtitle.${value}`) }))}
          />
        </Field>
        <Field name="readingFurigana" label={t("edit.fields.defaultFurigana")}>
          <Select
            id={fieldId("readingFurigana")}
            aria-label={t("edit.fields.defaultFurigana")}
            value={draft.readingFurigana}
            onValueChange={(readingFurigana) => set({ readingFurigana: readingFurigana as Draft["readingFurigana"] })}
            options={READING_FURIGANA_OPTIONS.map((value) => ({ value, label: t(`edit.furigana.${value}`) }))}
          />
        </Field>
      </div>
      <div role="group" aria-labelledby={practiceLabel}>
        <p id={practiceLabel} className="mb-2xs text-caption text-muted-foreground">{t("edit.fields.preferredPractice")}</p>
        <div className="flex flex-wrap gap-xs">
          {PREFERRED_PRACTICES.map((code) => {
            const on = draft.preferredPractices.includes(code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(code)}
                className={`h-control-sm rounded-full border px-sm text-caption ${
                  on ? "border-primary bg-primary/15 text-primary-strong" : "border-border text-muted-foreground"
                }`}
              >
                {t(`edit.practice.${code}`)}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
