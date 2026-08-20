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
 *     never touches it. This is the §2 rule-2 asset. `list()` is ONE LEVEL
 *     DEEP and paginates at 100 — a folder entry (`id === null`) has to be
 *     listed again to reach its contents, and a session with >100 objects
 *     needs more than one page. Getting either wrong reports success while
 *     leaving recordings behind with nothing left to find them by.
 *  2. `on delete set null` columns — forum_posts.user_id, forum_comments.user_id,
 *     videos.added_by_user_id. Community content survives, anonymised. That is
 *     the intended GDPR outcome, not an oversight.
 *  3. `auth.users`, banned here and deleted only at the 90-day purge.
 *
 * Step order inside `executeDeletion` — ban, THEN storage, THEN tombstone,
 * THEN the `users` delete — and why it is exactly that order (review N1):
 *  - Ban is FIRST because it is the only step here that is itself reversible
 *    (an admin can clear `banned_until` by hand) and because banning before
 *    touching anything else stops the user creating new data mid-erasure.
 *  - Storage is still erased BEFORE the `users` row is deleted: a crash
 *    between those two strands recordings that no query can ever find again
 *    (`request.userId` would still be known if storage ran first and crashed
 *    before the `users` delete, but not the other way round). That is the
 *    ordering rationale from the original comment here, and moving the ban
 *    to the front does not touch it — the ban is independent of both steps.
 *  - The `users` delete is LAST because `account_deletion_requests.user_id`
 *    references `users(id) on delete cascade`: deleting `users` cascades
 *    that row away too, and `revertToPending` (lib/scheduler/jobs/account-deletion.ts)
 *    can no longer find it to retry from. Every step before the `users`
 *    delete is safe to retry after a failure; the `users` delete itself is
 *    the point of no return.
 */

const RECORDINGS_BUCKET = "recordings";

/** Ban for a century: Supabase has no "disable forever", and the 90-day purge
 *  is what actually removes the row. */
const BAN_DURATION = "876000h";

/** Supabase Storage's `list()` default page size. Made explicit (rather than
 *  omitted and left to the client default) so the pagination loop below has
 *  a concrete number to compare a page's length against. */
const LIST_PAGE_SIZE = 100;

type StorageEntry = { name: string; id: string | null };

/** Lists every entry directly under `prefix`, paging through results.
 *  `list()` returns at most `LIST_PAGE_SIZE` by default; one shadowing
 *  session per object means a heavy user can exceed that easily. */
async function listAllEntries(
  service: ReturnType<typeof createServiceClient>,
  prefix: string,
): Promise<StorageEntry[]> {
  const bucket = service.storage.from(RECORDINGS_BUCKET);
  const entries: StorageEntry[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await bucket.list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) throw error;
    const page = data ?? [];
    entries.push(...page);
    if (page.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }
  return entries;
}

/** Recursively collects every FILE key under `prefix`. Storage's `list()` is
 *  one level deep only: an entry with `id === null` is a folder, not a leaf,
 *  and has to be listed again to reach what is actually inside it. */
async function collectFileKeys(
  service: ReturnType<typeof createServiceClient>,
  prefix: string,
): Promise<string[]> {
  const entries = await listAllEntries(service, prefix);
  const keys: string[] = [];
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      keys.push(...(await collectFileKeys(service, path)));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

async function eraseStoragePrefix(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<void> {
  const keys = await collectFileKeys(service, userId);
  if (keys.length === 0) return;

  const bucket = service.storage.from(RECORDINGS_BUCKET);
  const { data, error } = await bucket.remove(keys);
  if (error) throw error;

  // `remove()` reports what it ACTUALLY deleted — trust that count, not the
  // absence of an error, or a path-convention change elsewhere in the repo
  // silently spares recordings while this function reports success.
  const removedCount = (data ?? []).length;
  if (removedCount !== keys.length) {
    throw new Error(
      `Storage erase incomplete for user ${userId}: asked to remove ${keys.length} ` +
        `object(s), Storage reported ${removedCount}. Refusing to proceed to the ` +
        `irreversible users-row delete while recordings may remain.`,
    );
  }
}

/** `purgeAfter` is required whenever the tier is `erase_all` and forbidden
 *  otherwise — made unrepresentable rather than checked at runtime, so a
 *  null slipping through can't reach the point where storage is already gone
 *  and the only remaining step is a NOT NULL violation on the tombstone. */
export type ExecuteDeletionRequest =
  | { id: string; userId: string; tier: Extract<DeletionTier, "erase_all">; purgeAfter: string }
  | { id: string; userId: string; tier: Extract<DeletionTier, "close_account">; purgeAfter: null };

export async function executeDeletion(request: ExecuteDeletionRequest, now: Date): Promise<void> {
  // `request.id` — the deletion-request row's own id — is accepted for
  // call-shape symmetry with the scheduler that dispatches here, but unused:
  // the scheduler already transitioned that row to `executed` before calling
  // this function, so there is nothing left for this function to do with it.
  const service = createServiceClient();

  // Ban FIRST, for both tiers, before anything irreversible: see the step-order
  // note in the file header (review N1). A failure here leaves nothing to undo.
  const { error: banError } = await service.auth.admin.updateUserById(request.userId, {
    ban_duration: BAN_DURATION,
  });
  if (banError) throw banError;

  if (request.tier === "erase_all") {
    // Storage next, still BEFORE the users row (see file header).
    await eraseStoragePrefix(service, request.userId);

    // Upsert, not insert (I7): `user_id` is the tombstone's primary key, and
    // this step re-running after a downstream failure — the only recovery
    // the claim-first scheduler leaves — must not collide on it. The
    // tombstone is a statement of fact about a user, not an event log, so
    // re-stating it is harmless.
    const { error: tombstoneError } = await service
      .from("account_deletion_tombstones")
      .upsert(
        {
          user_id: request.userId,
          tier: request.tier,
          executed_at: now.toISOString(),
          purge_after: request.purgeAfter,
        },
        { onConflict: "user_id" },
      );
    if (tombstoneError) throw tombstoneError;

    // LAST: this cascades account_deletion_requests away too (see file
    // header) — the point past which revertToPending can no longer work.
    const { error: deleteError } = await service.from("users").delete().eq("id", request.userId);
    if (deleteError) throw deleteError;
  }
}

/** Frees the email. The last step, 90 days after the request.
 *
 * Idempotent on "already gone": a 404 here means some earlier pass already
 * deleted this auth user and then failed on the step that follows it (the
 * scheduler's tombstone-row delete, per review I3) — the thing this function
 * promises ("this auth user no longer exists") is already true, so treating
 * it as success lets a retry converge instead of throwing forever. Any other
 * error still throws. */
export async function purgeAuthUser(userId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) throw error;
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
