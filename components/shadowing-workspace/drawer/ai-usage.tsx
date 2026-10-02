"use client";

import { useTranslations } from "@/lib/i18n";
import type { KnowledgeUsage } from "./ai-knowledge-context";

/** Whole hours until `iso`, at least 1 — "resets in 5 h". */
export function hoursUntil(iso: string, now = Date.now()): number {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? 1 : Math.max(1, Math.ceil((at - now) / 3_600_000));
}

/** Free: sentences used today and when the day resets. Plus: the share of this month's AI left, as a bar. */
export function AiUsage({ usage }: { usage: KnowledgeUsage | null }) {
  const t = useTranslations("shadowing");
  if (!usage) return null;
  if (usage.plan === "free") {
    return (
      <p className="text-caption text-muted-foreground">
        {t("workspace.ai.usage.free", { used: usage.used, limit: usage.limit, hours: hoursUntil(usage.resetsAt) })}
      </p>
    );
  }
  const percent = Math.min(100, Math.max(0, usage.remainingPercent));
  return (
    <div className="space-y-3xs">
      <p className="text-caption text-muted-foreground">{t("workspace.ai.usage.plus", { percent })}</p>
      <div
        role="meter"
        aria-label={t("workspace.ai.usage.plusLabel")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
