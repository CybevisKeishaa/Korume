import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Admin authorization guard (Layer 7 — CMS/video-approval/stats). Source of
 * truth is `users.is_admin` (migration 20260714000014), which is NOT
 * client-writable — the `authenticated` role's UPDATE grant on `users`
 * explicitly excludes that column, so the only way a row gets `is_admin =
 * true` is through this module's own service-role write, or a manual DB
 * change. Every check here reads/writes through the service-role client,
 * never the normal RLS-scoped one — this must never depend on (or be
 * bypassable via) anything the `authenticated` role's grants happen to allow.
 *
 * `ADMIN_EMAILS` (comma-separated, case-insensitive, trimmed) is a BOOTSTRAP
 * mechanism only: the very first admin(s) have no DB row with `is_admin =
 * true` yet, so there is no other way to grant it without a manual SQL
 * console session. The first time a signed-in user whose email is on that
 * list calls `requireAdmin()`, this promotes their row (service-role write,
 * logged once) and lets the request through; every later call finds
 * `is_admin` already `true` and never touches the bootstrap path again.
 * `ADMIN_EMAILS` absent/empty simply disables bootstrap — the DB flag alone
 * still works for anyone already promoted (by a prior bootstrap, or set
 * directly in the DB by another admin/operator).
 *
 * Never trust a client-supplied admin flag: `requireAdmin()` takes no
 * arguments and derives the caller entirely from the authenticated session.
 */

export interface AdminUser {
  id: string;
  email: string;
}

export type RequireAdminResult = { ok: true; user: AdminUser } | { ok: false; status: 401 | 403 };

interface UsersAdminRow {
  id: string;
  email: string;
  is_admin: boolean;
}

function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

/**
 * Authorize the current request as an admin action. See the module doc
 * comment above for the full bootstrap contract. Resolves to:
 * - `{ ok: false, status: 401 }` — no signed-in user.
 * - `{ ok: false, status: 403 }` — signed in, but not an admin (and not
 *   eligible for ADMIN_EMAILS bootstrap).
 * - `{ ok: true, user }` — authorized; `user` is the caller's id + email.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { ok: false, status: 401 };

  const service = createServiceClient();
  const { data, error } = await service
    .from("users")
    .select("id, email, is_admin")
    .eq("id", authUser.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 403 };

  const row = data as UsersAdminRow;
  if (row.is_admin) {
    return { ok: true, user: { id: row.id, email: row.email } };
  }

  const bootstrapEmails = parseAdminEmails();
  const normalizedEmail = row.email.trim().toLowerCase();
  if (bootstrapEmails.length > 0 && bootstrapEmails.includes(normalizedEmail)) {
    const { error: promoteError } = await service.from("users").update({ is_admin: true }).eq("id", row.id);
    if (promoteError) throw promoteError;
    // eslint-disable-next-line no-console -- deliberate one-line audit log for a privilege escalation, not debug noise.
    console.log(`[admin] bootstrap: promoted ${row.email} to admin via ADMIN_EMAILS`);
    return { ok: true, user: { id: row.id, email: row.email } };
  }

  return { ok: false, status: 403 };
}

/**
 * Lightweight boolean check with NO bootstrap side effect — for call sites
 * that only need to know (e.g. whether to show an "Admin" nav link), not
 * enforce. Never use this to gate an actual admin write/read; use
 * `requireAdmin()` for that so the ADMIN_EMAILS bootstrap path still works.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.from("users").select("is_admin").eq("id", userId).maybeSingle();
  if (error) throw error;
  return Boolean((data as { is_admin: boolean } | null)?.is_admin);
}
