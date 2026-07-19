import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { routing } from "@/lib/i18n/routing";
import { stripLocale } from "@/lib/i18n/locale-path";

/** OAuth / email-confirmation callback: exchange the code for a session. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  // This route is excluded from the intl middleware (including it would 307
  // /auth/callback to /vi/auth/callback and break every Google sign-in), so
  // nothing adds a locale prefix on our behalf. `next` is built by
  // app/[locale]/(auth)/actions.ts and carries the locale the user was on;
  // recover it there, and fall back to the default locale.
  const locale = next ? stripLocale(next).locale ?? routing.defaultLocale
                      : routing.defaultLocale;
  const redirectTo = next ?? `/${locale}/dashboard`;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=auth`);
}
