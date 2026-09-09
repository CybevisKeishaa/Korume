import type { PlanTier } from "@/lib/data/subscriptions";
import { VideoImportForm } from "@/components/video/video-import-form";

export interface HubImportSectionLabels {
  eyebrow: string;
  title: string;
  body: string;
  support: string;
  freePlan: string;
  importsRemaining: string;
  quotaUnlimited: string;
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
  const importsRemaining = limit === null ? 0 : Math.max(limit - used, 0);

  return (
    <section
      id="hub-import"
      aria-labelledby="hub-import-heading"
      className="rounded-lg border border-border bg-card p-md-lg"
    >
      <div className="flex flex-col gap-md xl:grid xl:grid-cols-[minmax(0,1fr)_6rem] xl:gap-lg">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{labels.eyebrow}</p>
          <h2 id="hub-import-heading" className="mt-xs text-heading font-semibold tracking-tight text-foreground">
            {labels.title}
          </h2>
          <p className="mt-xs text-body text-muted-foreground">{labels.body}</p>
          <div className="mt-md">
            <VideoImportForm variant="hub" />
          </div>
          <p className="mt-sm text-caption text-muted-foreground">{labels.support}</p>
        </div>

        <div className="rounded-md border border-border bg-input-background p-sm text-right xl:min-h-[6.375rem]">
          {hasUnlimitedImports ? (
            <p className="text-caption font-medium text-muted-foreground">{labels.quotaUnlimited}</p>
          ) : (
            <div className="flex w-full items-center justify-between xl:block">
              <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">{labels.freePlan}</p>
              <p className="text-heading font-semibold text-foreground xl:mt-xs">
                {importsRemaining} <span className="text-body font-normal text-muted-foreground">/ {limit}</span>
              </p>
              <p className="text-caption text-muted-foreground xl:mt-xs">{labels.importsRemaining}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
