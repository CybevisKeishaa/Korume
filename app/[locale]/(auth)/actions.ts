"use server";

import { headers } from "next/headers";
import { redirect } from "@/lib/i18n/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@/lib/validation/auth";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { stripLocale } from "@/lib/i18n/locale-path";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface ResendState {
  status?: "sent" | "rateLimited";
}

export interface ResetRequestState {
  sent?: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
}

type AuthTranslator = Awaited<ReturnType<typeof getTranslations<"auth">>>;

/**
 * `loginSchema`/`registerSchema` (lib/validation/auth.ts) are locale-free —
 * their `.email()`/`.min()`/`.max()` messages are `auth.validation.*` catalog
 * KEYS, not display text, so the schema can be reused from any context. By
 * the time a key reaches here it has already been widened to a plain
 * `string` (`ZodIssue.message`'s type), so it can't be handed to `t()`
 * directly — `t` only accepts the literal union of known keys. Matching on a
 * hardcoded literal per `case` (rather than casting `key` into the narrow
 * type) is what keeps this exhaustive-by-construction: adding a new
 * `validation.*` key without a case here falls through to `default` and
 * leaks the raw key, which is a visible bug, not a silent one.
 */
function translateValidationKey(key: string, t: AuthTranslator): string {
  switch (key) {
    case "validation.emailInvalid":
      return t("validation.emailInvalid");
    case "validation.passwordRequired":
      return t("validation.passwordRequired");
    case "validation.nameRequired":
      return t("validation.nameRequired");
    case "validation.passwordTooShort":
      return t("validation.passwordTooShort");
    case "validation.passwordTooLong":
      return t("validation.passwordTooLong");
    case "validation.passwordMismatch":
      return t("validation.passwordMismatch");
    case "validation.codeInvalid":
      return t("validation.codeInvalid");
    default:
      return key;
  }
}

/** Resolves every zod-emitted catalog key in a `flatten().fieldErrors` map to display text. */
function translateFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
  t: AuthTranslator,
): Record<string, string[] | undefined> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, keys]) => [
      field,
      keys?.map((key) => translateValidationKey(key, t)),
    ]),
  );
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const t = await getTranslations("auth");
    return {
      fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t),
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "email_not_confirmed") {
    const locale = await getLocale();
    redirect({
      href: `/verify-email?email=${encodeURIComponent(parsed.data.email)}&resend=1`,
      locale,
    });
  }
  if (error) {
    // Don't reveal which of email/password was wrong. Translated at the
    // point of return — the client receives display text, never a catalog
    // key, so the error shape stays independent of the message catalog.
    const t = await getTranslations("auth");
    return { error: t("errors.invalidCredentials") };
  }

  revalidatePath("/", "layout");
  const redirectTo = safeRedirectPath(formData.get("redirectTo"));
  const locale = await getLocale();
  // `redirectTo` (when present) already carries its own locale prefix — it is
  // built by lib/supabase/middleware.ts's signed-out bounce. The locale-aware
  // `redirect` below always adds its own prefix for the given `locale`, so an
  // already-prefixed target must be stripped first (`stripLocale`, also used
  // by the auth middleware) — passing it through unstripped would double the
  // prefix ("/en/en/..."). The fallback (no redirectTo, e.g. a direct
  // GET /login) has no prefix to strip.
  const target = redirectTo ? stripLocale(redirectTo).pathname : "/dashboard";
  redirect({ href: target, locale });
}

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const t = await getTranslations("auth");
    return {
      fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t),
    };
  }

  const supabase = createClient();
  const origin = headers().get("origin") ?? "";
  const locale = await getLocale();
  // app/auth/callback/route.ts is deliberately excluded from the intl
  // middleware (it's not localized), so it has no other way to learn which
  // locale the user was on — its own fallback is the unprefixed default
  // locale. Passing `next` here is what keeps an `en` user in `en` after
  // confirming their email.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${origin}/auth/callback?next=/${locale}/dashboard`,
    },
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  // If email confirmation is required, there is no session yet — send them to
  // sign in; otherwise they're already authenticated.
  redirect({
    href: data.session
      ? "/dashboard"
      : `/verify-email?email=${encodeURIComponent(parsed.data.email)}`,
    locale,
  });
}

export async function verifyEmail(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = verifyEmailSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    const t = await getTranslations("auth");
    return {
      fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t),
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error) {
    const t = await getTranslations("auth");
    return { error: t("errors.codeInvalid") };
  }

  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/dashboard", locale });
}

export async function resendCode(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "sent" };

  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });
  return { status: error?.code === "over_email_send_rate_limit" ? "rateLimited" : "sent" };
}

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    const t = await getTranslations("auth");
    return {
      fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t),
    };
  }

  const supabase = createClient();
  const origin = headers().get("origin") ?? "";
  const locale = await getLocale();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/${locale}/reset-password`,
  });
  return { sent: true };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const t = await getTranslations("auth");
    return {
      fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t),
    };
  }

  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const t = await getTranslations("auth");
    return { error: t("errors.resetExpired") };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const t = await getTranslations("auth");
    return {
      error:
        error.code === "same_password"
          ? t("errors.samePassword")
          : t("errors.passwordUpdateFailed"),
    };
  }

  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/dashboard", locale });
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = createClient();
  const origin = headers().get("origin") ?? "";
  const locale = await getLocale();
  // Same reasoning as register()'s emailRedirectTo above: the callback route
  // can't recover the locale on its own, so it must be forwarded via `next`.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/${locale}/dashboard`,
    },
  });
  if (error) {
    redirect({ href: "/login?error=oauth", locale });
  }
  if (data.url) {
    // Absolute external URL (Google's consent screen) — no locale to add.
    // The locale-aware redirect leaves non-local hrefs (anything with a
    // protocol) untouched, so passing it through here does not prefix it.
    redirect({ href: data.url, locale });
  }
}
