/**
 * The provider-agnostic email port (mirrors `lib/ai/port.ts`'s split, Spec
 * D9-style): application code calls `sendEmail` from `lib/email/service.ts`
 * with a TEMPLATE NAME and typed variables, never a subject/HTML string it
 * built itself — the template owns EN/VI copy, escaping, and rendering.
 * Adapters (`lib/email/providers/*`) only ever see a fully-rendered message.
 */
import type { Locale } from "@/lib/i18n/routing";
import type { DeletionTier } from "@/lib/account-deletion/lifecycle";
import type { EmailProviderName } from "./env";

export type { EmailProviderName };

/**
 * One entry per template this deployment can send. Deliberately started with
 * exactly one: the account-deletion-requested notification L9b Plan 1 owed
 * (`mem:l9b_plan1_gdpr_run_state`). Add a template here + its render module
 * under `templates/` when a feature actually needs one — this map is not a
 * place to pre-stub emails nothing sends yet.
 */
export interface EmailTemplateVariables {
  "account-deletion-requested": {
    /**
     * `close_account` and `erase_all` are NOT the same claim — the dialog
     * this request came from tells `close_account` users their learning
     * data is kept (`deleteDialog.close_account.subtitle`), so the template
     * must render per-tier copy, never a hardcoded "your data is being
     * deleted" for both (code review, `feat/email-notification-system`).
     */
    tier: DeletionTier;
    /** ISO timestamp — the row's `execute_after`. The template formats it. */
    executeAfter: string;
    /** Absolute URL to the settings page where the request can be reviewed or cancelled. */
    cancelUrl: string;
  };
}

export type EmailTemplateName = keyof EmailTemplateVariables;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplate<K extends EmailTemplateName> {
  render(locale: Locale, variables: EmailTemplateVariables[K]): RenderedEmail;
}

export interface SendEmailInput<K extends EmailTemplateName> {
  template: K;
  to: string;
  locale: Locale;
  variables: EmailTemplateVariables[K];
}

export type SendEmailResult =
  | { status: "sent"; id: string; provider: EmailProviderName }
  /** `EMAIL_PROVIDER=none` — intentionally disabled, not a failure. */
  | { status: "skipped" };

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(message: RenderedEmail & { to: string }): Promise<{ id: string }>;
}
