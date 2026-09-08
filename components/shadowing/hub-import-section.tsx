"use client";

import type { PlanTier } from "@/lib/data/subscriptions";
import { useTranslations } from "@/lib/i18n";
import { VideoImportForm } from "@/components/video/video-import-form";
import { HubSectionHeading } from "./hub-section-heading";

export interface HubImportSectionProps {
  used: number;
  limit: number | null;
  tier: PlanTier;
}

/**
 * The Hub's import boundary. The server remains authoritative for quota
 * enforcement; this only gives the learner the quota fact known at render.
 */
export function HubImportSection({ used, limit, tier }: HubImportSectionProps) {
  const t = useTranslations("videos");
  const hasUnlimitedImports = tier === "plus" || limit === null;

  return (
    <section aria-labelledby="hub-import-heading" className="rounded-xl border border-border bg-card p-md-lg">
      <div id="hub-import-heading">
        <HubSectionHeading title={t("import")} />
      </div>
      <p className="mt-sm text-sm text-muted-foreground">
        {hasUnlimitedImports ? t("quota.unlimited") : t("quota.used", { used, limit })}
      </p>
      <div className="mt-md">
        <VideoImportForm />
      </div>
    </section>
  );
}
