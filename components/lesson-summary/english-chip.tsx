"use client";

import { useTranslations } from "@/lib/i18n";

/** Spec §1.8: an English fallback says so — it never passes for a Vietnamese meaning. Render it BEFORE the meaning:
 *  the meaning sits in a line clamp, and a trailing chip would be the first thing a long gloss cuts off. */
export function EnglishChip() {
  const t = useTranslations("shadowing.lessonSummary.words");
  return (
    <abbr title={t("englishMeaningLabel")} className="me-xs inline-block rounded-sm border border-border px-2xs align-middle text-caption font-semibold text-muted-foreground no-underline">
      {t("englishMeaning")}
      <span className="sr-only"> — {t("englishMeaningLabel")}</span>
    </abbr>
  );
}
