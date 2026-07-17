import { redirect } from "@/lib/i18n/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/admin/guard";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Server-side gate for the whole `/admin` route group, delegating to
 * `requireAdmin()` (`lib/admin/guard.ts`) — the same check every
 * `/api/admin/*` route runs. Using `requireAdmin` (not the side-effect-free
 * `isAdmin`) matters here: it is the ONLY place the `ADMIN_EMAILS` bootstrap
 * promotion fires, so the very first admin's plain visit to `/admin`
 * completes the bootstrap instead of bouncing them to `/dashboard` before
 * any admin API was ever called.
 *
 * A signed-out visitor goes to `/login` (middleware already enforces this
 * too — defence in depth); a signed-in non-admin goes to `/dashboard` (they
 * ARE authenticated, just not authorized for this section).
 *
 * This is a separate, minimal admin shell (`AdminShell`) — deliberately NOT
 * the learner `AppNav` used by `app/(app)/layout.tsx`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  if (!hasPublicSupabaseEnv()) redirect({ href: "/login", locale });

  const admin = await requireAdmin();
  if (!admin.ok) redirect({ href: admin.status === 401 ? "/login" : "/dashboard", locale });

  return <AdminShell userEmail={admin.user.email}>{children}</AdminShell>;
}
