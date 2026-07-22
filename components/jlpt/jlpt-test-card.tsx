import { Link } from "@/lib/i18n/navigation";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { parseSectionConfig, type JlptTestListItem } from "@/lib/jlpt-ui";

export interface JlptTestCardProps {
  test: JlptTestListItem;
}

/**
 * One JLPT mock test: level, title, per-section counts/time limits, and
 * links into a full mock or per-section practice (spec §5.7). A non-async
 * Server Component — `useTranslations` works here without `"use client"`
 * (same precedent as `components/learning/recommendation-rail.tsx`).
 */
export function JlptTestCard({ test }: JlptTestCardProps) {
  const t = useTranslations("jlpt");
  const sections = parseSectionConfig(test.section_config);

  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {test.level}
        </span>
        <h3 className="font-jp mt-2 text-lg font-semibold">{test.title}</h3>
      </div>

      {sections.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {sections.map((s) => (
            <li key={s.section} className="flex items-center justify-between gap-4">
              <span>{t(`sections.${s.section}`)}</span>
              <span>
                {t("testCard.sectionSummary", { count: s.question_count, minutes: s.time_limit_minutes })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Link href={`/jlpt/${test.id}`} className={buttonStyles({ size: "sm" })}>
          {t("testCard.takeFullMock")}
        </Link>
        {sections.map((s) => (
          <Link
            key={s.section}
            href={`/jlpt/${test.id}?section=${s.section}`}
            className={buttonStyles({ variant: "outline", size: "sm" })}
          >
            {t("testCard.practiceSection", { section: t(`sections.${s.section}`) })}
          </Link>
        ))}
      </div>
    </Card>
  );
}
