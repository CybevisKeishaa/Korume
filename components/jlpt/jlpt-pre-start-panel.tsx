import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import type { JlptLevel, JlptSection } from "@/lib/jlpt-ui";

export interface JlptPreStartPanelProps {
  title: string;
  level: JlptLevel;
  mode: "full" | "section";
  section?: JlptSection;
  questionCount: number;
  durationMinutes: number;
  onStart: () => void;
}

/**
 * Test-info screen shown before the timer starts (spec §5.7). Only ever
 * rendered from `jlpt-test-runner.tsx` (a `"use client"` component), which
 * pulls this module into the client bundle regardless of its own lack of a
 * `"use client"` directive — so this uses the universal `useTranslations`
 * hook, not the server-only `getTranslations`.
 */
export function JlptPreStartPanel({
  title,
  level,
  mode,
  section,
  questionCount,
  durationMinutes,
  onStart,
}: JlptPreStartPanelProps) {
  const t = useTranslations("jlpt");

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {level}
        </span>
        <h1 className="font-jp mt-2 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "full"
            ? t("preStart.fullMockDescription")
            : t("preStart.sectionPracticeDescription", {
                section: section ? t(`sections.${section}`) : "",
              })}
        </p>
      </div>

      <Card className="p-5">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("preStart.questionsLabel")}</dt>
            <dd className="text-lg font-semibold">{questionCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("preStart.timeLimitLabel")}</dt>
            <dd className="text-lg font-semibold">{t("preStart.durationMinutes", { minutes: durationMinutes })}</dd>
          </div>
        </dl>
      </Card>

      <p className="text-sm text-muted-foreground">
        {t("preStart.instructions")}
      </p>

      <Button type="button" size="lg" onClick={onStart} autoFocus>
        {t("preStart.start")}
      </Button>
    </div>
  );
}
