"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/lib/i18n";
import type { SectionView } from "@/lib/knowledge/types";
import type { SectionResult } from "./ai-knowledge-context";
import { hoursUntil } from "./ai-usage";
import { SectionContent } from "./section-renderers";

const BUTTON = "inline-flex h-control-sm items-center rounded-md border border-border px-sm text-caption font-medium text-foreground hover:bg-muted";

/**
 * One section's body in every state of spec §6.4. `onRequest` is the explicit action: nothing here requests by
 * itself. A preview is locked: 🔒, the preview, and why — Plus — with no button.
 */
export function AiSectionBody({ view, result, onRequest }: {
  view: SectionView;
  result: SectionResult | undefined;
  onRequest: (force: boolean) => void;
}) {
  const t = useTranslations("shadowing");
  if (!result) {
    return <button type="button" onClick={() => onRequest(false)} className={BUTTON}>{t("workspace.ai.generate")}</button>;
  }
  switch (result.status) {
    case "loading":
    case "pending":
      return (
        <div aria-busy="true" className="space-y-2xs">
          {result.status === "pending" && <p className="text-caption text-muted-foreground">{t("workspace.ai.generating")}</p>}
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      );
    case "quota":
      return <p className="text-body text-muted-foreground">{t("workspace.ai.quota", { hours: hoursUntil(result.resetsAt) })}</p>;
    case "resting":
      return <p className="text-body text-muted-foreground">{t("workspace.ai.resting")}</p>;
    case "error":
      return (
        <div className="space-y-2xs">
          <p className="text-body text-muted-foreground">{t("workspace.ai.failed")}</p>
          <button type="button" onClick={() => onRequest(true)} className={BUTTON}>{t("workspace.ai.retry")}</button>
        </div>
      );
    case "ready": {
      const locked = result.access === "preview";
      return (
        <div className="space-y-xs">
          <p className="text-caption font-medium text-muted-foreground">{t("workspace.selection.aiGenerated")}</p>
          <SectionContent view={view} content={result.content} preview={locked} />
          {locked && (
            <p className="rounded-md bg-muted px-sm py-xs text-caption text-foreground">
              <span aria-hidden="true">🔒 </span>{t("workspace.ai.locked")}
            </p>
          )}
        </div>
      );
    }
  }
}
