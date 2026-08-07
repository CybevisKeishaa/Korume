import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user for the current request, or null.
 *
 * `cache()` is load-bearing, not an optimisation: `(protected)/layout.tsx`
 * needs the user for the auth gate and `(app)/layout.tsx` needs it for the nav
 * footer, and a child layout cannot receive props from its parent. Without
 * dedupe that is two `auth.getUser()` round trips on every protected render.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
