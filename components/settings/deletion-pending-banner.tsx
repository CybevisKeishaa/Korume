"use client";

import { useEffect, useRef, useState } from "react";
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
 * Fix round 1 (2026-08-21):
 *
 * - **Tier-aware copy (Important #1).** `title`/`body`/`switchNote` read from
 *   `settings.pending.${pending.tier}` — a complete, independent copy block
 *   per tier (same shape `DeleteDataDialog` uses for `deleteDialog.${tier}`),
 *   not a partial override. A `close_account` request is data-preserving;
 *   rendering `erase_all`'s wording for it would tell the user the opposite
 *   of what they were just promised in the dialog they confirmed.
 * - **`switchNote` (Important #2)** is the visible explanation for why BOTH
 *   Danger Zone rows are disabled while a request is pending: changing to a
 *   different kind of request requires cancelling this one first (the
 *   `account_deletion_requests` schema allows only one live row per user).
 * - **`role="status"` now scopes only the title+body paragraphs (#6)**, not
 *   the whole card — nesting `role="alert"` (the cancel-failure line) inside
 *   `role="status"` is undefined behaviour and made some screen readers
 *   re-announce the entire card on every error.
 * - **Focus moves to this banner on mount (Important #4).** `Dialog` restores
 *   focus to the trigger it captured on open; when a confirm handler both
 *   sets `pending` and closes the dialog in the same commit, the trigger it
 *   restores focus to already carries `disabled` (the Danger Zone row this
 *   pending state disables), and `HTMLElement.focus()` on a disabled button
 *   is a no-op — focus would land nowhere, immediately after the most
 *   destructive action in the product. The container below is `tabIndex={-1}`
 *   and focuses itself on mount, which also fires the first time this banner
 *   appears on a normal page load with an existing request — an intentional,
 *   not incidental, choice: next-intl route changes are not reliably
 *   announced by screen readers, and moving focus to the most relevant
 *   content on render is the same "route announcer" pattern SPAs use for
 *   that gap.
 * - **Docstring correction (#5):** a previous version of this comment
 *   claimed the (assertive) live region "announces the new content to a
 *   screen-reader user who never moved focus." Screen readers generally only
 *   announce mutations to regions that were already present before the
 *   content changed — a region and its content inserted in the same commit,
 *   as happens here, is unreliable across NVDA/JAWS/VoiceOver. The guarantee
 *   this component actually makes is the explicit focus move above, which is
 *   asserted directly in `privacy-screen.test.tsx`; `role="status"` is kept
 *   because it is still the correct semantic role for this steady-state
 *   content, not because it is relied on to deliver the initial
 *   announcement.
 */
export function DeletionPendingBanner({
  pending,
  onCancelled,
  refreshPending,
}: {
  pending: PendingDeletion;
  onCancelled: () => void;
  /**
   * Re-fetches and re-syncs `PrivacyScreen`'s `pending` state from the
   * server — called here when a cancel returns `404` (fix round 1, ruled-up
   * #7): a cancelled-in-another-tab request must not be assumed by this tab;
   * the server decides what the banner shows next, including removing it.
   */
  refreshPending: () => Promise<void>;
}) {
  const t = useTranslations("settings");
  const format = useFormatter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Same tier-key composition `DeleteDataDialog` uses for `deleteDialog.tier`
  // — `pending.tier` is exactly `DeletionTier`'s two literal values, so it
  // doubles as the copy-block key with no separate tier→key map to keep in
  // sync (CLAUDE.md §6, one fact one home).
  const copy = `pending.${pending.tier}` as const;

  async function cancel(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/user/deletion", { method: "DELETE" });
      if (!response.ok) {
        // Branch on the STATUS only, never the body — the same no-parse
        // discipline `delete-data-dialog.tsx` established (CLAUDE.md §2/§6,
        // the defect class L9a closed five times).
        if (response.status === 404) {
          // A 404 here means "no pending request" — which could mean this
          // request was already cancelled from another tab, OR that it was
          // never live to begin with. Either way this tab's belief is
          // stale; ask the server what's actually true rather than
          // rendering a "try again" message for a cancel that can never
          // succeed (ruled-up #7).
          void refreshPending();
          return;
        }
        // 401/429 mirror the dialog's own mapping — the same feature
        // shipping two different behaviours for the same two statuses would
        // be a "one fact, one home" violation (CLAUDE.md §6).
        if (response.status === 401) setError(t("deleteDialog.signedOut"));
        else if (response.status === 429) setError(t("deleteDialog.tooMany"));
        else setError(t("pending.failed"));
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
    <div
      ref={containerRef}
      tabIndex={-1}
      className="rounded-lg border border-danger/40 bg-danger/5 p-lg focus:outline-none focus:ring-2 focus:ring-danger"
    >
      <div role="status">
        <p className="text-body font-semibold">{t(`${copy}.title`)}</p>
        <p className="mt-xs text-caption text-muted-foreground">
          {t(`${copy}.body`, {
            date: format.dateTime(new Date(pending.executeAfter), {
              dateStyle: "long",
              timeZone: VN_TIME_ZONE,
            }),
          })}
        </p>
      </div>
      <p className="mt-sm text-caption text-muted-foreground">{t(`${copy}.switchNote`)}</p>
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
