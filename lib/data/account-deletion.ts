import "server-only";
import { createClient } from "@/lib/supabase/server";
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

  // `status` is deliberately absent: the column defaults to 'pending' and the
  // INSERT policy pins it there. Sending it would let a client name its own.
  const { data, error } = await supabase
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
  | { ok: false; status: 401 };

export async function getPendingDeletion(): Promise<GetPendingDeletionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("id, tier, requested_at, execute_after")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;

  return { ok: true, data: data ? toPending(data as Row) : null };
}
