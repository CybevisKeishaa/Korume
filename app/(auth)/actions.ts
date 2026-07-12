"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

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
  redirect(safeRedirectPath(formData.get("redirectTo")) ?? "/dashboard");
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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  // If email confirmation is required, there is no session yet — send them to
  // sign in; otherwise they're already authenticated.
  redirect(data.session ? "/dashboard" : "/login?checkEmail=1");
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = createClient();
  const origin = headers().get("origin") ?? "";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    redirect("/login?error=oauth");
  }
  if (data.url) {
    redirect(data.url);
  }
}
