import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import type { SavedKnowledge } from "@/lib/summary/snapshot";
import { areaProps } from "./area";

/** Spec §3.2: three real counts and a retention tile in words ("3 remembered"), never a percentage. */
export function SavedKnowledgeCard({ saved }: { saved: SavedKnowledge }) {
  const t = useTranslations("shadowing.lessonSummary.saved");
  const tiles = [
    { label: t("vocabulary"), value: String(saved.vocabulary) },
    { label: t("expressions"), value: String(saved.expressions) },
    { label: t("grammar"), value: String(saved.grammar) },
    {
      label: t("retention"),
      value: saved.retention.kind === "count" ? t("remembered", { count: saved.retention.value }) : t("notEnoughData"),
    },
  ];
  return (
    <Card {...areaProps("saved")} role="region" aria-labelledby="summary-saved-title" className="space-y-md p-lg">
      <h2 id="summary-saved-title" className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</h2>
      <dl className="grid grid-cols-2 gap-md">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col-reverse gap-2xs">
            <dt className="text-caption text-muted-foreground">{tile.label}</dt>
            <dd className="text-heading font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-caption text-muted-foreground">{t("footnote")}</p>
    </Card>
  );
}
