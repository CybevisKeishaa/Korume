import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import type { LessonStatus, ModeState } from "@/lib/summary/snapshot";
import { modeQuality } from "@/lib/summary/thresholds";
import { cn } from "@/lib/utils";
import { areaProps } from "./area";

const MODES = ["shadowing", "pronunciation", "listening", "retention"] as const;

/** Spec §3.1: four rows, read from the tables; "Not started" and a real 0 are different things. */
export function LessonStatusCard({ status }: { status: LessonStatus }) {
  const t = useTranslations("shadowing.lessonSummary.status");
  const value = (state: ModeState) => {
    switch (state.kind) {
      case "not_started": return t("notStarted");
      case "not_enough_data": return t("notEnoughData");
      case "complete": return t("complete");
      case "in_progress": return t("percent", { value: state.percent });
      case "scored": return t("score", { value: state.score });
    }
  };
  return (
    <Card {...areaProps("status")} role="region" aria-labelledby="summary-status-title" className="space-y-sm p-lg">
      <h2 id="summary-status-title" className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-md gap-y-xs text-body">
        {MODES.map((mode) => {
          const quality = modeQuality(mode, status[mode]);
          return (
            <div key={mode} className="contents">
              <dt className="text-muted-foreground">{t(mode)}</dt>
              <dd className={cn(
                "text-end font-semibold tabular-nums",
                quality === "strong" && "text-success-strong",
                quality === "needs_work" && "text-primary-strong",
                quality === "not_started" && "font-normal text-muted-foreground",
              )}>
                {value(status[mode])}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
