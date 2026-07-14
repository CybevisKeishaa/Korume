import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

/**
 * Server-side gate for the whole `/admin` route group. Two checks, in order:
 * 1. Signed in at all (mirrors `app/(app)/layout.tsx`'s own defence-in-depth
 *    check — middleware already enforces this too, see `middleware.ts`).
 * 2. `isAdmin(user.id)` (`lib/admin/guard.ts`, NOT edited by this agent —
 *    read-only per this task's file ownership). A non-admin signed-in user
 *    is bounced to `/dashboard`, not `/login` (they ARE authenticated; they
 *    just aren't authorized for this section).
 *
 * This is a separate, minimal admin shell (`AdminShell`) — deliberately NOT
 * the learner `AppNav` used by `app/(app)/layout.tsx`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasPublicSupabaseEnv()) redirect("/login");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = await isAdmin(user.id);
  if (!admin) redirect("/dashboard");

  return <AdminShell userEmail={user.email ?? ""}>{children}</AdminShell>;
}
