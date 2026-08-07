import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { hasPublicSupabaseEnv } from "@/lib/env";

/**
 * The signed-in user for the current request, or null.
 *
 * `cache()` is load-bearing, not an optimisation: `(protected)/layout.tsx`
 * needs the user for the auth gate and `(app)/layout.tsx` needs it for the nav
 * footer, and a child layout cannot receive props from its parent. Without
 * dedupe that is two `auth.getUser()` round trips on every protected render.
 *
 * The `hasPublicSupabaseEnv()` guard (final whole-branch review F11,
 * 2026-08-07) restores what the layout this function replaced used to check
 * before rendering children: `createClient()` -> `publicEnv.supabaseUrl()`
 * throws when the env is unset, and `(protected)/layout.tsx` redirects before
 * children render — so today this is probably unreachable — but the
 * codebase explicitly supports the "runs before `.env.local` exists" state
 * (see `hasPublicSupabaseEnv`'s own callers), and this removes the question
 * rather than relying on every future caller redirecting first.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!hasPublicSupabaseEnv()) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
