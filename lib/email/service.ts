/**
 * The email port's single entry point. Application code (`lib/data/account-
 * deletion.ts` today) calls this with a template name and typed variables —
 * never a subject/HTML string it built itself (Spec-style port, see
 * `types.ts`'s doc comment).
 */
import "server-only";
import type { EnvSource } from "@/lib/env/validate";
import { EmailNotConfiguredError } from "./errors";
import { getProvider } from "./registry";
import { template as accountDeletionRequested } from "./templates/account-deletion-requested";
import type { EmailProvider, EmailTemplate, EmailTemplateName, SendEmailInput, SendEmailResult } from "./types";

/**
 * Exhaustive by construction: `Record<EmailTemplateName, ...>` means adding a
 * template name to `types.ts` without a matching entry here is a compile
 * error, not a runtime "unknown template" branch to test.
 */
const TEMPLATES: { [K in EmailTemplateName]: EmailTemplate<K> } = {
  "account-deletion-requested": accountDeletionRequested,
};

/**
 * `EMAIL_PROVIDER=none` resolves to `{ status: "skipped" }`, not a thrown
 * error — unlike the AI port, sending a notification is a best-effort side
 * effect of an already-committed action (e.g. a deletion request), never the
 * thing the caller is trying to do. A genuine provider failure (a real
 * transport rejecting the send) still propagates; the caller decides whether
 * that should block its own operation.
 */
export async function sendEmail<K extends EmailTemplateName>(
  input: SendEmailInput<K>,
  env: EnvSource = process.env,
): Promise<SendEmailResult> {
  let provider: EmailProvider;
  try {
    provider = getProvider(env);
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) return { status: "skipped" };
    throw error;
  }

  const rendered = TEMPLATES[input.template].render(input.locale, input.variables);
  const { id } = await provider.send({ ...rendered, to: input.to });
  return { status: "sent", id, provider: provider.name };
}
