import type { PlanTier } from "@/lib/data/subscriptions";
import { VideoImportForm } from "@/components/video/video-import-form";
import { HubSectionHeading } from "./hub-section-heading";

export interface HubImportSectionLabels {
  title: string;
  quotaUnlimited: string;
  quotaUsed: (used: number, limit: number) => string;
}

export interface HubImportSectionProps {
  used: number;
  limit: number | null;
  tier: PlanTier;
  labels: HubImportSectionLabels;
}

/**
 * The Hub's import boundary. The server remains authoritative for quota
 * enforcement; this only gives the learner the quota fact known at render.
 */
export function HubImportSection({ used, limit, tier, labels }: HubImportSectionProps) {
  const hasUnlimitedImports = tier === "plus" || limit === null;

  return (
    <section id="hub-import" aria-labelledby="hub-import-heading" className="rounded-xl border border-border bg-card p-md-lg">
      <div id="hub-import-heading">
        <HubSectionHeading title={labels.title} />
      </div>
      <p className="mt-sm text-sm text-muted-foreground">
        {hasUnlimitedImports ? labels.quotaUnlimited : labels.quotaUsed(used, limit ?? 0)}
      </p>
      <div className="mt-md">
        <VideoImportForm />
      </div>
    </section>
  );
}
