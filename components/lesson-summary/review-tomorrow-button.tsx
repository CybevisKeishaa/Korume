"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

/**
 * Spec §6.2: schedules every review target of the lesson for the next local midnight. After success the button
 * stays focused and `aria-disabled` (never `disabled`, which would drop focus) and further clicks send nothing.
 */
export function ReviewTomorrowButton({ videoId, reviewTargetTotal }: { videoId: string; reviewTargetTotal: number }) {
  const t = useTranslations("shadowing.lessonSummary.reflection");
  const [state, setState] = useState<"idle" | "busy" | "scheduled" | "failed">("idle");
  if (reviewTargetTotal === 0) return null;

  const schedule = async () => {
    if (state === "busy" || state === "scheduled") return;
    setState("busy");
    try {
      const response = await fetch(`/api/videos/${videoId}/review-tomorrow`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      setState(response.ok ? "scheduled" : "failed");
    } catch {
      setState("failed");
    }
  };

  const scheduled = state === "scheduled";
  return (
    <div className="space-y-2xs">
      <Button
        size="sm"
        aria-disabled={scheduled || undefined}
        aria-busy={state === "busy" || undefined}
        className="aria-disabled:cursor-default aria-disabled:opacity-80"
        onClick={() => void schedule()}
      >
        {scheduled ? t("scheduled") : t("reviewTomorrow")}
      </Button>
      <p role="status" className="sr-only">{scheduled ? t("scheduled") : ""}</p>
      {state === "failed" && <p role="alert" className="text-caption text-danger-strong">{t("scheduleFailed")}</p>}
    </div>
  );
}
