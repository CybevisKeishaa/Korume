"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "@/lib/i18n";
import type { TurnNotice as Notice } from "./use-korume-thread";

/** "Slow down" counts down on its own; the other notices are static until the next send. */
function useCountdown(seconds: number | null): number {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    setLeft(seconds ?? 0);
    if (!seconds) return;
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  return left;
}

/**
 * Inline status under the conversation (spec §6.4) — never a toast or a modal. Times arrive as ISO strings and
 * are formatted here, in the learner's own time zone.
 */
export function TurnNotice({ notice }: { notice: Notice }) {
  const t = useTranslations("companion");
  const locale = useLocale();
  const left = useCountdown(notice.kind === "slow_down" ? notice.retryAfterSeconds : null);
  let text: string;
  switch (notice.kind) {
    case "free_daily_limit":
      text = t("ask.limitFree", {
        limit: notice.limit,
        time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(notice.resetsAt)),
      });
      break;
    case "plus_credits_exhausted":
      text = t("ask.limitPlus", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(notice.resetsAt)) });
      break;
    case "slow_down": text = t("ask.slowDown", { seconds: left }); break;
    case "resting": text = t("ask.resting"); break;
    case "conflict": text = t("ask.conflict"); break;
    case "disabled": text = t("ask.disabled"); break;
  }
  return (
    <p role="status" className="rounded-lg border border-border bg-muted px-md py-sm text-body text-muted-foreground">
      {text}
    </p>
  );
}
