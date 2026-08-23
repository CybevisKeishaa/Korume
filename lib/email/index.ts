/**
 * Server-only barrel — the backend-engineer imports from `@/lib/email`.
 * Mirrors `lib/ai/index.ts`'s shape.
 */
export { sendEmail } from "./service";
export { emailEnvSpec, isEmailEnabled, setProviderForTesting } from "./registry";
export { EmailNotConfiguredError } from "./errors";

export type {
  EmailProviderName,
  EmailTemplateName,
  EmailTemplateVariables,
  RenderedEmail,
  SendEmailInput,
  SendEmailResult,
} from "./types";
