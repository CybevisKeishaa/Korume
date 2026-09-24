"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "@/lib/i18n";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { LOCALE_ENDONYMS, routing, type Locale } from "@/lib/i18n/routing";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  ALL_DAYS, DAILY_MINUTES_OPTIONS, DIFFICULTY_OPTIONS, LEARNING_SCHEDULE_OPTIONS,
  REVIEW_FREQUENCY_OPTIONS, canonicalScheduleDays,
  type Difficulty, type IsoWeekday, type LearningSchedule, type ReviewFrequency,
} from "@/lib/preferences/options";
import { SettingsSection } from "./settings-section";
import { SettingsRow } from "./settings-row";
import { usePreferenceSave } from "./use-preference-save";

/**
 * The Learning band (spec §2). Study Reminder Time ships in the
 * `study-reminders` branch, so this is five rows, not six.
 */
export function LearningSection() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { preferences } = usePreferences();

  const goal = usePreferenceSave("dailyMinutes");
  const schedule = usePreferenceSave("learningSchedule");
  const frequency = usePreferenceSave("reviewFrequency");
  const difficulty = usePreferenceSave("difficulty");

  const languageId = useId();
  const goalId = useId();
  const [dayError, setDayError] = useState(false);
  const dayErrorId = useId();

  /**
   * Choosing a language is a NAVIGATION, not a preference: the locale lives in
   * the URL (`localePrefix: "always"`), so there is nothing to PATCH and
   * nothing that could fall out of step with the address bar. `router.replace`
   * rather than `push` — swapping the interface language is not a place in
   * history a Back button should return you to.
   */
  const changeLocale = (next: string) => {
    router.replace(pathname, { locale: next as Locale });
  };

  const setSchedule = (next: LearningSchedule) => {
    setDayError(false);
    // `custom` keeps whatever days are already chosen rather than resetting
    // them: a user switching away and back has not changed their mind about
    // which days they study. The server canonicalises the other two modes, so
    // the body carries only what each mode actually needs.
    if (next === "custom") {
      const days = preferences.scheduleDays.length > 0 ? preferences.scheduleDays : [...ALL_DAYS];
      void schedule.save(
        { learningSchedule: "custom", scheduleDays: days },
        { learningSchedule: "custom", scheduleDays: days },
      );
      return;
    }
    void schedule.save(
      { learningSchedule: next },
      { learningSchedule: next, scheduleDays: canonicalScheduleDays(next, []) },
    );
  };

  const toggleDay = (day: IsoWeekday) => {
    const on = preferences.scheduleDays.includes(day);
    const days = on
      ? preferences.scheduleDays.filter((d) => d !== day)
      : [...preferences.scheduleDays, day].sort((a, b) => a - b);

    // Spec §4.3 / the schema's `.min(1)`: an empty schedule is refused here
    // rather than sent and 400'd, so the user gets a reason instead of a
    // generic save failure. Never sent — the inline hint IS the outcome.
    if (days.length === 0) {
      setDayError(true);
      return;
    }
    setDayError(false);
    void schedule.save(
      { learningSchedule: "custom", scheduleDays: days },
      { learningSchedule: "custom", scheduleDays: days },
    );
  };

  return (
    <SettingsSection title={t("page.learning.title")} subtitle={t("page.learning.subtitle")}>
      <SettingsRow
        icon="language"
        label={t("page.language.label")}
        description={t("page.language.description")}
        htmlFor={languageId}
        control={
          <Select
            id={languageId}
            value={locale}
            onValueChange={changeLocale}
            options={routing.locales.map((value) => ({ value, label: LOCALE_ENDONYMS[value] }))}
            aria-label={t("page.language.label")}
          />
        }
      />

      <SettingsRow
        icon="goal"
        label={t("page.dailyGoal.label")}
        description={t("page.dailyGoal.description")}
        htmlFor={goalId}
        control={
          <Select
            id={goalId}
            value={String(preferences.dailyMinutes)}
            onValueChange={(value) => {
              const minutes = Number(value);
              void goal.save({ dailyMinutes: minutes }, { dailyMinutes: minutes });
            }}
            options={DAILY_MINUTES_OPTIONS.map((minutes) => ({
              value: String(minutes),
              label: t("page.dailyGoal.option", { minutes }),
            }))}
            aria-label={t("page.dailyGoal.label")}
          />
        }
      />

      <SettingsRow
        icon="schedule"
        label={t("page.schedule.label")}
        description={t("page.schedule.description")}
        control={
          <SegmentedControl<LearningSchedule>
            value={preferences.learningSchedule}
            onValueChange={setSchedule}
            options={LEARNING_SCHEDULE_OPTIONS.map((value) => ({
              value,
              label: t(`page.schedule.${value}`),
            }))}
            aria-label={t("page.schedule.label")}
          />
        }
      >
        {preferences.learningSchedule === "custom" ? (
          <div className="mt-sm ps-lg">
            <div
              role="group"
              aria-label={t("page.schedule.daysLabel")}
              aria-describedby={dayError ? dayErrorId : undefined}
              className="flex flex-wrap gap-2xs"
            >
              {ALL_DAYS.map((day) => {
                const on = preferences.scheduleDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    // `aria-pressed` rather than a checkbox: these are toggle
                    // buttons in a labelled group, which is what the frame
                    // draws and what announces state without a visible label
                    // per day.
                    aria-pressed={on}
                    onClick={() => toggleDay(day)}
                    className={`h-control-sm rounded-full border px-sm text-caption ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {t(`page.schedule.day.${day}`)}
                  </button>
                );
              })}
            </div>
            {dayError ? (
              <p id={dayErrorId} role="alert" className="mt-xs text-caption text-danger-strong">
                {t("page.schedule.atLeastOne")}
              </p>
            ) : null}
          </div>
        ) : null}
      </SettingsRow>

      <SettingsRow
        icon="frequency"
        label={t("page.reviewFrequency.label")}
        description={t("page.reviewFrequency.description")}
        control={
          <SegmentedControl<ReviewFrequency>
            value={preferences.reviewFrequency}
            onValueChange={(value) =>
              void frequency.save({ reviewFrequency: value }, { reviewFrequency: value })
            }
            options={REVIEW_FREQUENCY_OPTIONS.map((value) => ({
              value,
              label: t(`page.reviewFrequency.${value}`),
            }))}
            aria-label={t("page.reviewFrequency.label")}
          />
        }
      />

      <SettingsRow
        icon="difficulty"
        label={t("page.difficulty.label")}
        description={t("page.difficulty.description")}
        control={
          <SegmentedControl<Difficulty>
            value={preferences.difficulty}
            onValueChange={(value) => void difficulty.save({ difficulty: value }, { difficulty: value })}
            options={DIFFICULTY_OPTIONS.map((value) => ({
              value,
              label: t(`page.difficulty.${value}`),
            }))}
            aria-label={t("page.difficulty.label")}
          />
        }
      />
    </SettingsSection>
  );
}
