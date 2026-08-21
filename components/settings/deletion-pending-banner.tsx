"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "@/lib/i18n";
import type { PendingDeletion } from "@/lib/data/account-deletion";

/**
 * The market is VN-only and there is no global `timeZone` in
 * `lib/i18n/request.ts`, so next-intl falls back to the ENVIRONMENT's zone —
 * the server's on first paint, the browser's after hydration — which raises
 * an `ENVIRONMENT_FALLBACK` IntlError and can render two different dates for
 * the same instant. Pinning it explicitly is required, not cosmetic; matches
 * `components/companion/journal-view.tsx`'s established constant.
 */
const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * The state `337:3323` does not draw (spec §2, Amendment C case 4). Built
 * from the card + outline-button language already on that screen — no new
 * visual vocabulary is invented for it.
 *
 * `role="status"` (polite live region), not `role="alert"`: this block is
 * present at initial render whenever a request already exists — a banner
 * that ASSERTIVELY interrupts on every page load is noise, not a fresh
 * event. Polite status is also the reason it earns its keep on the OTHER
 * path: when `PrivacyScreen` composes this in after a successful POST with
 * no reload, the live region announces the new content to a screen-reader
 * user who never moved focus. The cancel failure below is its own, separate
 * `role="alert"` — a genuinely new, assertive event the user needs to know
 * about immediately.
 */
export function DeletionPendingBanner({
  pending,
  onCancelled,
}: {
  pending: PendingDeletion;
  onCancelled: () => void;
}) {
  const t = useTranslations("settings");
  const format = useFormatter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function cancel(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/user/deletion", { method: "DELETE" });
      if (!response.ok) {
        // Branch on the STATUS only, never the body — the same no-parse
        // discipline `delete-data-dialog.tsx` established (CLAUDE.md §2/§6,
        // the defect class L9a closed five times). Every failure status
        // (404 already-cancelled/expired, 401, 429, 500) maps to the same
        // generic translated message: none of them is a "try a different
        // thing" situation the user can act on differently.
        setError(t("pending.failed"));
        return;
      }
      onCancelled();
    } catch {
      setError(t("pending.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="status" className="rounded-lg border border-danger/40 bg-danger/5 p-lg">
      <p className="text-body font-semibold">{t("pending.title")}</p>
      <p className="mt-xs text-caption text-muted-foreground">
        {t("pending.body", {
          date: format.dateTime(new Date(pending.executeAfter), {
            dateStyle: "long",
            timeZone: VN_TIME_ZONE,
          }),
        })}
      </p>
      {error ? (
        <p role="alert" className="mt-sm text-caption text-danger-strong">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={submitting}
        className="mt-md rounded-full border border-danger px-md py-xs text-caption font-semibold text-danger-strong hover:bg-danger hover:text-danger-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {t("pending.cancel")}
      </button>
    </div>
  );
}
