import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { scheduleFor, type DeletionTier } from "@/lib/account-deletion/lifecycle";
import { cancelPendingDeletion } from "@/lib/account-deletion/erase";
import type { DeletionRequestInput } from "@/lib/validation/account-deletion";

/** Destructive and enumerable — a tighter budget than an ordinary toggle. */
const DELETION_LIMIT = { limit: 5, windowMs: 60_000 };

export interface PendingDeletion {
  id: string;
  tier: DeletionTier;
  requestedAt: string;
  executeAfter: string;
}

/**
 * The client-facing read outcome for `/settings/privacy` (fix round 1,
 * Important #3(b)): `null` means genuinely no pending request; `"unknown"`
 * means the read failed and the true state could not be determined. These
 * must never be conflated — collapsing a failed read to `null` told a user
 * mid-cancellation-window that nothing was scheduled when the truth was
 * simply unknown, which is the more dangerous direction to be wrong in.
 */
export type PendingDeletionRead = PendingDeletion | null | "unknown";

type Row = { id: string; tier: DeletionTier; requested_at: string; execute_after: string };

const toPending = (row: Row): PendingDeletion => ({
  id: row.id,
  tier: row.tier,
  requestedAt: row.requested_at,
  executeAfter: row.execute_after,
});

export type RequestDeletionResult =
  | { ok: true; data: PendingDeletion }
  | { ok: false; status: 401 | 409 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * ⚠️ The INSERT runs through the SERVICE-ROLE client, and that is a security
 * control, not a convenience (whole-branch review, C2).
 *
 * It used to run through the user's client, which forced `authenticated` to
 * hold an INSERT grant on `account_deletion_requests`. The insert policy
 * constrained only `user_id` and `status` — `tier`, `execute_after` and
 * `purge_after` were free — so anyone holding a session token could POST
 * straight to PostgREST with `tier: 'erase_all'`, `execute_after: now()`,
 * `purge_after: now()`. Within one 60-second scheduler tick the row was
 * claimed, the full erasure ran, and the same pass's purge loop deleted the
 * `auth.users` row: irreversible annihilation about a minute after one HTTP
 * call, with the typed `DELETE` confirmation, the acknowledgement checkbox and
 * the entire 7-day cancellation window bypassed. Reproduced against a real
 * local database at `ba28de2`.
 *
 * `user_id` here comes from `requireUser`, never from the caller's body, so
 * RLS was adding nothing on this path in the first place. With the write
 * moved here, `20260820000031_account_deletion_insert_service_role_only.sql`
 * revokes INSERT from `authenticated` and drops the insert policy — there is
 * no longer any direct client route to a row of this table.
 *
 * The 7-day window itself stays a single fact in
 * `lib/account-deletion/lifecycle.ts` (CLAUDE.md §6): this fix removes the
 * bypass without restating the window anywhere else.
 */
export async function requestDeletion(
  input: DeletionRequestInput,
  now: Date = new Date(),
): Promise<RequestDeletionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`deletion:request:${user.id}`, DELETION_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { executeAfter, purgeAfter } = scheduleFor(input.tier, now);

  // `status` is deliberately absent: the column defaults to 'pending'. Sending
  // it would let a caller name its own — and there is no longer an INSERT
  // policy pinning it, because there is no longer a client INSERT path at all.
  const { data, error } = await createServiceClient()
    .from("account_deletion_requests")
    .insert({
      user_id: user.id,
      tier: input.tier,
      execute_after: executeAfter.toISOString(),
      purge_after: purgeAfter?.toISOString() ?? null,
    })
    .select("id, tier, requested_at, execute_after")
    .single();

  // 23505 = the one-live-request partial unique index. A second request is a
  // conflict the user can act on, not a server fault.
  if (error?.code === "23505") return { ok: false, status: 409 };
  if (error) throw error;

  return { ok: true, data: toPending(data as Row) };
}

export type CancelDeletionResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function cancelDeletion(now: Date = new Date()): Promise<CancelDeletionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`deletion:cancel:${user.id}`, DELETION_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  // `authenticated` has no UPDATE grant (migration 20260820000029), so the
  // transition runs through the service-role owner of this module's writes.
  const cancelled = await cancelPendingDeletion(user.id, now);
  return cancelled ? { ok: true } : { ok: false, status: 404 };
}

export type GetPendingDeletionResult =
  | { ok: true; data: PendingDeletion | null }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * The read stays on the USER's client, and the SELECT policy stays in place
 * (C2 removed only the INSERT half): `user_id = auth.uid()` is what scopes
 * this to the caller's own row. A service-role read would be scoped by
 * nothing but the `.eq()` below.
 *
 * Rate-limited like POST and DELETE — spec §8 says every route, and this one
 * enumerates the existence and execution date of a pending deletion.
 */
export async function getPendingDeletion(
  now: Date = new Date(),
): Promise<GetPendingDeletionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`deletion:status:${user.id}`, DELETION_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("id, tier, requested_at, execute_after")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;

  return { ok: true, data: data ? toPending(data as Row) : null };
}
