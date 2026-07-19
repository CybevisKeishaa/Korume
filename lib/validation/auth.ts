import { z } from "zod";

/**
 * Deliberately locale-free: this schema must not import `@/lib/i18n` (or
 * `next-intl` directly). Its `.email()`/`.min()`/`.max()` messages are
 * `auth.validation.*` catalog KEYS, not display text — that is what lets the
 * schema be reused from any context without dragging in a request locale.
 * The boundary that has one (`app/[locale]/(auth)/actions.ts`, via
 * `getTranslations("auth")`) resolves each key to text before it ever
 * reaches the client. See `messages/en/auth.json` / `messages/vi/auth.json`
 * for the resolved copy, and `translateValidationKey` in actions.ts for the
 * key -> text mapping.
 */
export const loginSchema = z.object({
  email: z.string().trim().email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordRequired"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "validation.nameRequired").max(80),
  email: z.string().trim().email("validation.emailInvalid"),
  password: z
    .string()
    .min(8, "validation.passwordTooShort")
    .max(72, "validation.passwordTooLong"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
