/**
 * The `account-deletion-requested` notification — the vertical slice
 * `mem:l9b_plan1_gdpr_run_state` § Owed left unbuilt: the 7-day cancellation
 * window is otherwise the only thing that lets a victim of an unwanted
 * request notice it, and the only channel announcing it was the settings
 * page itself.
 *
 * Same discipline `messages/settings.pin.test.ts` enforces on the dialog this
 * request came from, self-guarded here in `account-deletion-requested.test.ts`:
 * never claim the deletion already happened, never claim it is irreversible —
 * this email goes out at the START of the 7-day window, before anything has
 * been touched. Tier-aware for the same reason that file pins BOTH tiers
 * separately: `close_account` and `erase_all` are not the same claim
 * (`messages/en/settings.json`'s `deleteDialog.close_account.subtitle` —
 * "Your learning data is not deleted" — vs `erase_all`'s deletion framing).
 * A hardcoded erase-all subject/body sent for a `close_account` request would
 * tell that user their data is being deleted, which is false and is the same
 * defect class the C1 ruling closed on the in-app copy this email mirrors
 * (code review, `feat/email-notification-system`).
 *
 * Copy lives here as TS, not in `messages/{locale}/*.json`, on purpose: this
 * template renders outside any React tree or request-scoped
 * `NextIntlClientProvider` (`lib/data/account-deletion.ts` calls it directly,
 * not through `useTranslations`/`getTranslations`), and is unit-tested the
 * same way. It is intentionally a SEPARATE small catalog, not a gap in the
 * main one — `lib/i18n/catalog.test.ts`'s parity/ICU guards don't reach it,
 * which is why this file carries its own truthfulness tests instead.
 */
import type { DeletionTier } from "@/lib/account-deletion/lifecycle";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { VN_TIME_ZONE } from "@/lib/time/vn-timezone";
import type { EmailTemplate, RenderedEmail } from "../types";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (iso: string, intlLocale: string): string =>
  new Intl.DateTimeFormat(intlLocale, { dateStyle: "long", timeZone: VN_TIME_ZONE }).format(new Date(iso));

/** Tier-specific claims only. Shared wording (cancel/support) lives in `SHARED` below. */
const TIER_COPY = {
  en: {
    erase_all: {
      subject: "Your Korume account deletion request",
      received: "We received a request to delete your Korume account and data.",
      nothingYet: (date: string) => `Nothing has been deleted yet. Your request is scheduled to take effect on ${date}.`,
    },
    close_account: {
      subject: "Your Korume account closure request",
      received: "We received a request to close your Korume account. Your learning data is not deleted.",
      nothingYet: (date: string) => `Your account has not been closed yet. This request is scheduled to take effect on ${date}.`,
    },
  },
  vi: {
    erase_all: {
      subject: "Yêu cầu xóa tài khoản Korume của bạn",
      received: "Chúng tôi đã nhận được yêu cầu xóa tài khoản và dữ liệu Korume của bạn.",
      nothingYet: (date: string) => `Hiện chưa có gì bị xóa. Yêu cầu của bạn sẽ có hiệu lực vào ${date}.`,
    },
    close_account: {
      subject: "Yêu cầu đóng tài khoản Korume của bạn",
      received: "Chúng tôi đã nhận được yêu cầu đóng tài khoản Korume của bạn. Dữ liệu học của bạn không bị xóa.",
      nothingYet: (date: string) => `Tài khoản của bạn chưa đóng. Yêu cầu này sẽ có hiệu lực vào ${date}.`,
    },
  },
} satisfies Record<"en" | "vi", Record<DeletionTier, unknown>>;

const SHARED = {
  en: {
    intlLocale: "en-US",
    cancelIntro: "If this wasn't you, or you've changed your mind, you can cancel any time before then:",
    supportIntro: "Need help?",
    contact: (email: string) => `Contact ${email}.`,
  },
  vi: {
    intlLocale: "vi-VN",
    cancelIntro: "Nếu đây không phải là bạn, hoặc bạn đã đổi ý, bạn có thể hủy bất cứ lúc nào trước thời điểm đó:",
    supportIntro: "Cần trợ giúp?",
    contact: (email: string) => `Liên hệ ${email}.`,
  },
} as const;

export const template: EmailTemplate<"account-deletion-requested"> = {
  render(locale, { tier, executeAfter, cancelUrl }): RenderedEmail {
    const copy = TIER_COPY[locale][tier];
    const shared = SHARED[locale];
    const date = formatDate(executeAfter, shared.intlLocale);

    const text = [
      copy.received,
      copy.nothingYet(date),
      `${shared.cancelIntro} ${cancelUrl}`,
      `${shared.supportIntro} ${shared.contact(SUPPORT_EMAIL)}`,
    ].join("\n\n");

    const html = [
      `<p>${escapeHtml(copy.received)}</p>`,
      `<p>${escapeHtml(copy.nothingYet(date))}</p>`,
      `<p>${escapeHtml(shared.cancelIntro)} <a href="${escapeHtml(cancelUrl)}">${escapeHtml(cancelUrl)}</a></p>`,
      `<p>${escapeHtml(shared.supportIntro)} ${escapeHtml(shared.contact(SUPPORT_EMAIL))}</p>`,
    ].join("\n");

    return { subject: copy.subject, html, text };
  },
};
