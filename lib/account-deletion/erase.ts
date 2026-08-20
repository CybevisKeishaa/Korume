import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { DeletionTier } from "./lifecycle";

/**
 * The destructive half. Service-role only, and never imported by a route
 * handler — routes go through `lib/data/account-deletion.ts`.
 *
 * ⚠️ Deleting `public.users` cascades to every table declaring
 * `on delete cascade` on it — enumerate that set, never hardcode it:
 *   select conrelid::regclass from pg_constraint
 *    where contype='f' and confrelid='public.users'::regclass;
 *
 * Three things cascade does NOT reach, and each is a real hole if skipped:
 *  1. Storage. The `recordings` bucket is keyed `{uid}/…` and Postgres cascade
 *     never touches it. This is the §2 rule-2 asset.
 *  2. `on delete set null` columns — forum_posts.user_id, forum_comments.user_id,
 *     videos.added_by_user_id. Community content survives, anonymised. That is
 *     the intended GDPR outcome, not an oversight.
 *  3. `auth.users`, banned here and deleted only at the 90-day purge.
 */

const RECORDINGS_BUCKET = "recordings";

/** Ban for a century: Supabase has no "disable forever", and the 90-day purge
 *  is what actually removes the row. */
const BAN_DURATION = "876000h";

async function eraseStoragePrefix(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<void> {
  const bucket = service.storage.from(RECORDINGS_BUCKET);
  const { data, error } = await bucket.list(userId);
  if (error) throw error;
  const paths = (data ?? []).map((entry) => `${userId}/${entry.name}`);
  if (paths.length === 0) return;
  const { error: removeError } = await bucket.remove(paths);
  if (removeError) throw removeError;
}

export async function executeDeletion(
  request: { id: string; userId: string; tier: DeletionTier; purgeAfter: string | null },
  now: Date,
): Promise<void> {
  const service = createServiceClient();

  if (request.tier === "erase_all") {
    // Storage FIRST. After the users row is gone the id is still known here,
    // but a crash between the two leaves orphaned recordings no query can find.
    await eraseStoragePrefix(service, request.userId);

    const { error: tombstoneError } = await service.from("account_deletion_tombstones").insert({
      user_id: request.userId,
      tier: request.tier,
      executed_at: now.toISOString(),
      purge_after: request.purgeAfter,
    });
    if (tombstoneError) throw tombstoneError;

    const { error: deleteError } = await service.from("users").delete().eq("id", request.userId);
    if (deleteError) throw deleteError;
  }

  const { error: banError } = await service.auth.admin.updateUserById(request.userId, {
    ban_duration: BAN_DURATION,
  });
  if (banError) throw banError;
}

/** Frees the email. The last step, 90 days after the request. */
export async function purgeAuthUser(userId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/** Cancels the caller's live request. Returns false when there was none. */
export async function cancelPendingDeletion(userId: string, now: Date): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("account_deletion_requests")
    .update({ status: "cancelled", cancelled_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}
