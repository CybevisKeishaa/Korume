import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import type { NextLesson } from "@/lib/summary/navigation";
import { areaProps } from "./area";

/** Spec §7.2 rail: the next lesson of a path, else the i+1 recommendation. The page hides this when there is none. */
export function NextLessonCard({ next }: { next: NextLesson }) {
  const t = useTranslations("shadowing.lessonSummary.next");
  return (
    <Card {...areaProps("next")} role="region" aria-labelledby="summary-next-title" className="space-y-md p-lg">
      <h2 id="summary-next-title" className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{t("title")}</h2>
      <div className="space-y-2xs">
        <p className="text-caption text-muted-foreground">{next.reason === "path" ? t("path") : t("recommended")}</p>
        <p className="text-body font-semibold">{next.title}</p>
      </div>
      <Link href={next.href} className={buttonStyles({ className: "w-full" })}>{t("start")}</Link>
    </Card>
  );
}
