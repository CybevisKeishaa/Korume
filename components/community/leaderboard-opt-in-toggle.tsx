"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";

export interface LeaderboardOptInToggleProps {
  initialOptIn: boolean;
  /** Called after a successful PATCH with the new opt-in state, so the parent can refresh the ranked list. */
  onChanged: (optIn: boolean) => void;
  className?: string;
}

/**
 * G2 (docs/product/business-model.md §1.1): the leaderboard is opt-in only —
 * this toggle is the explicit, revocable consent to appear in it, with the
 * consequence stated plainly rather than buried. Its question/explanation
 * copy is a privacy surface (Task 16): the `vi` translation must state
 * exactly what the learner is agreeing to, never softened or broadened.
 */
export function LeaderboardOptInToggle({ initialOptIn, onChanged, className }: LeaderboardOptInToggleProps) {
  const t = useTranslations("leaderboard");
  const tCommon = useTranslations("common");
  const [optIn, setOptIn] = useState(initialOptIn);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function toggle(): Promise<void> {
    const next = !optIn;
    setOptIn(next);
    setError(null);
    try {
      const res = await fetch("/api/user/leaderboard-opt-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: next }),
      });
      if (res.ok) {
        onChanged(next);
        return;
      }
      setOptIn(!next);
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        setError(
          retryAfter
            ? t("optIn.tooManyWithSeconds", { seconds: retryAfter })
            : t("optIn.tooManyGeneric"),
        );
        return;
      }
      setError(t("optIn.updateError"));
    } catch {
      setOptIn(!next);
      setError(tCommon("errors.network"));
    }
  }

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <input
          id={inputId}
          type="checkbox"
          checked={optIn}
          onChange={() => void toggle()}
          aria-label={t("optIn.ariaLabel")}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <label htmlFor={inputId} className="text-sm">
          <span className="font-medium">{t("optIn.question")}</span>
          <span className="block text-xs text-muted-foreground">{t("optIn.explanation")}</span>
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}
