"use client";

import { useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { COUNTRY_CODES } from "@/lib/profile/countries";
import { NATIVE_LANGUAGES } from "@/lib/profile/languages";
import { DISPLAY_NAME_MAX } from "@/lib/profile/schema";
import { JLPT_LEVELS } from "@/lib/conversation-types";
import { DAILY_MINUTES_OPTIONS } from "@/lib/preferences/options";
import type { Draft } from "./draft";
import type { UsernameStatus } from "./use-username-availability";
import { Field, OptionalSelect, TextArea, describe, fieldId } from "./field";
import { Select } from "@/components/ui/select";

/** Region / language names from the runtime, sorted by the displayed name. */
function names(type: "region" | "language", locale: string, codes: readonly string[]) {
  let display: Intl.DisplayNames | null = null;
  try { display = new Intl.DisplayNames([locale], { type }); } catch { /* unknown locale: fall back to the code */ }
  return codes
    .map((value) => ({ value, label: display?.of(value) ?? value }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

const supportedZones = (): string[] => {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try { return intl.supportedValuesOf?.("timeZone") ?? []; } catch { return []; }
};

export const TIME_ZONE_LIST_ID = "profile-edit-timezone-list";

/** Basic information (spec §8.3). `errors` are already-translated messages keyed by field. */
export function BasicSection({
  draft, set, errors, usernameStatus, onTimeZoneBlur, photo,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  errors: Record<string, string | undefined>;
  usernameStatus: UsernameStatus;
  onTimeZoneBlur: () => void;
  photo: ReactNode;
}) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const countries = useMemo(() => names("region", locale, COUNTRY_CODES), [locale]);
  const languages = useMemo(() => names("language", locale, NATIVE_LANGUAGES), [locale]);
  const zones = useMemo(supportedZones, []);
  const usernameHint =
    usernameStatus === "checking" ? t("edit.username.checking")
    : usernameStatus === "available" ? t("edit.username.available")
    : t("edit.hints.username");

  return (
    <section aria-labelledby="profile-edit-basic" className="grid gap-sm border-t border-border pt-md">
      <h2 id="profile-edit-basic" className="text-body-lg font-semibold">{t("edit.sections.basic")}</h2>
      {photo}
      <div className="profile-edit-pair">
        <Field name="displayName" label={t("edit.fields.displayName")} error={errors.displayName}>
          <Input
            id={fieldId("displayName")}
            value={draft.displayName}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="nickname"
            onChange={(event) => set({ displayName: event.target.value })}
            {...describe("displayName", Boolean(errors.displayName))}
          />
        </Field>
        <Field name="username" label={t("edit.fields.username")} error={errors.username} hint={usernameHint}>
          <Input
            id={fieldId("username")}
            value={draft.username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => set({ username: event.target.value })}
            {...describe("username", Boolean(errors.username))}
          />
        </Field>
      </div>
      <Field name="bio" label={t("edit.fields.bio")} error={errors.bio}>
        <TextArea
          id={fieldId("bio")}
          rows={3}
          value={draft.bio}
          onChange={(event) => set({ bio: event.target.value })}
          {...describe("bio", Boolean(errors.bio))}
        />
      </Field>
      <div className="profile-edit-fields">
        <Field name="country" label={t("edit.fields.country")} error={errors.country}>
          <OptionalSelect name="country" label={t("edit.fields.country")} value={draft.country} onChange={(country) => set({ country })} options={countries} notSet={t("edit.notSet")} />
        </Field>
        <Field name="timeZone" label={t("edit.fields.timeZone")} error={errors.timeZone} hint={t("edit.hints.timeZone")}>
          <Input
            id={fieldId("timeZone")}
            value={draft.timeZone}
            list={TIME_ZONE_LIST_ID}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => set({ timeZone: event.target.value })}
            onBlur={onTimeZoneBlur}
            {...describe("timeZone", Boolean(errors.timeZone))}
          />
          <datalist id={TIME_ZONE_LIST_ID}>
            {zones.map((zone) => <option key={zone} value={zone} />)}
          </datalist>
        </Field>
        <Field name="nativeLanguage" label={t("edit.fields.nativeLanguage")}>
          <OptionalSelect name="nativeLanguage" label={t("edit.fields.nativeLanguage")} value={draft.nativeLanguage} onChange={(nativeLanguage) => set({ nativeLanguage })} options={languages} notSet={t("edit.notSet")} />
        </Field>
        <Field name="targetJlpt" label={t("edit.fields.targetJlpt")}>
          <OptionalSelect name="targetJlpt" label={t("edit.fields.targetJlpt")} value={draft.targetJlptLevel} onChange={(targetJlptLevel) => set({ targetJlptLevel })} options={JLPT_LEVELS.map((level) => ({ value: level, label: level }))} notSet={t("edit.notSet")} />
        </Field>
        <Field name="dailyGoal" label={t("edit.fields.dailyGoal")}>
          <Select
            id={fieldId("dailyGoal")}
            aria-label={t("edit.fields.dailyGoal")}
            value={String(draft.dailyMinutes)}
            onValueChange={(minutes) => set({ dailyMinutes: Number(minutes) })}
            options={DAILY_MINUTES_OPTIONS.map((minutes) => ({ value: String(minutes), label: t("edit.dailyMinutes", { minutes }) }))}
          />
        </Field>
      </div>
      <Field name="learningGoal" label={t("edit.fields.learningGoal")} error={errors.learningGoal}>
        <TextArea
          id={fieldId("learningGoal")}
          rows={3}
          value={draft.learningGoal}
          onChange={(event) => set({ learningGoal: event.target.value })}
          {...describe("learningGoal", Boolean(errors.learningGoal))}
        />
      </Field>
    </section>
  );
}
