/**
 * The one IANA timezone this product treats as "the" user timezone — the
 * market is VN-only and there is no global `timeZone` in `lib/i18n/request.ts`,
 * so next-intl (and any bare `Intl.DateTimeFormat` call outside a component)
 * would otherwise fall back to the ENVIRONMENT's zone: the server's on first
 * paint, the browser's after hydration, which can render two different dates
 * for the same instant.
 *
 * Previously declared separately in `components/companion/journal-view.tsx`
 * and `components/settings/deletion-pending-banner.tsx` (CLAUDE.md §6 calls
 * "both, kept in sync by hand" a defect) — extracted here so a third caller
 * (`lib/email/templates/account-deletion-requested.ts`) didn't make it a
 * fourth (code review, `feat/email-notification-system`).
 */
export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
