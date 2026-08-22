"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";

export interface AiTrainingToggleProps {
  /**
   * Server-read initial state (`lib/data/model-training-consent.ts`'s
   * `getModelTrainingConsent`, called from `page.tsx` — no `GET` route; the
   * page reads the DB directly). This governs whether the caller's voice
   * recordings may train models (CLAUDE.md §2 rule 2), so a misreported
   * initial state is not a polish gap: an opted-in user who saw a stale
   * "off" toggle could click it believing they were turning consent ON when
   * they were actually turning it OFF. The read fails closed (`false`) on
   * any auth or DB failure — this component never fetches its own initial
   * value and must be trusted to render exactly what it was given.
   */
  initialConsent: boolean;
}

/**
 * CLAUDE.md §2 rule 2's opt-in consent to use recordings and learning data
 * for model training — `PATCH /api/user/model-training-consent` (Task 7).
 * Off by default, matching `users.model_training_consent`'s DB default
 * (migration 20260820000029).
 *
 * Optimistic update with rollback, mirroring
 * `components/community/leaderboard-opt-in-toggle.tsx`'s established
 * pattern. Never renders the server's own error text (CLAUDE.md §2/§6).
 */
export function AiTrainingToggle({ initialConsent }: AiTrainingToggleProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [consent, setConsent] = useState(initialConsent);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function toggle(): Promise<void> {
    const next = !consent;
    setConsent(next);
    setError(null);
    try {
      const response = await fetch("/api/user/model-training-consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: next }),
      });
      if (response.ok) return;
      setConsent(!next);
      setError(tCommon("states.error"));
    } catch {
      setConsent(!next);
      setError(tCommon("errors.network"));
    }
  }

  return (
    <section className="mt-xl rounded-lg border border-border bg-card p-lg">
      <div className="flex items-start gap-sm">
        <input
          id={inputId}
          type="checkbox"
          checked={consent}
          onChange={() => void toggle()}
          className="mt-2xs h-4 w-4 accent-primary"
        />
        <label htmlFor={inputId}>
          <span className="block text-body font-semibold">{t("aiTraining.title")}</span>
          <span className="mt-2xs block text-caption text-muted-foreground">{t("aiTraining.body")}</span>
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-sm text-caption text-danger-strong">
          {error}
        </p>
      ) : null}
    </section>
  );
}
