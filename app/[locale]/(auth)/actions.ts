"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { getLocale } from "@/lib/i18n/server";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
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
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Don't reveal which of email/password was wrong.
    return { error: "Invalid email or password." };
  }

  revalidatePath("/", "layout");
  const redirectTo = safeRedirectPath(formData.get("redirectTo"));
  // `redirectTo` (when present) already carries its own locale prefix — it is
  // built by lib/supabase/middleware.ts's signed-out bounce. Only the
  // fallback (no redirectTo, e.g. a direct GET /login) needs one added here;
  // prefixing an already-prefixed redirectTo would double it ("/en/en/...").
  redirect(redirectTo ?? `/${await getLocale()}/dashboard`);
}

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
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
  redirect(
    data.session ? `/${locale}/dashboard` : `/${locale}/login?checkEmail=1`,
  );
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
    redirect(`/${locale}/login?error=oauth`);
  }
  if (data.url) {
    // Absolute external URL (Google's consent screen) — no locale to add.
    redirect(data.url);
  }
}
