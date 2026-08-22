import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { executeDeletion, liftBan, purgeAuthUser } from "@/lib/account-deletion/erase";
import type { ScheduledJob } from "../registry";
import { DELETION_TIERS } from "@/lib/account-deletion/lifecycle";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Validates a claimed row before any of its fields drive an irreversible
 * deletion (review m7 — casting `as DueRow` trusted PostgREST's response
 * shape without checking it). `tier` is built from `DELETION_TIERS`
 * (lifecycle.ts) rather than a separately spelled literal list, same as
 * `lib/validation/account-deletion.ts` — one fact, one home.
 */
const dueRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  tier: z.enum(DELETION_TIERS),
  purge_after: z.string().nullable(),
});
type DueRow = z.infer<typeof dueRowSchema>;

/** Same reasoning as `dueRowSchema` (review N3): `user_id` here drives
 *  `purgeAuthUser`, an irreversible auth deletion, so it is validated before
 *  use rather than trusted via an `as` cast. */
const duePurgeRowSchema = z.object({ user_id: z.string() });
type DuePurgeRow = z.infer<typeof duePurgeRowSchema>;

/** Same reasoning again (I1): `id` here drives an UPDATE that puts a row back
 *  in the deletion queue, so it is validated rather than `as`-cast. */
const strandedRowSchema = z.object({ id: z.string(), user_id: z.string() });

/** Counts logged once per run, success or failure (review I6) — so "nothing
 *  was due" and "three users were erased, then it blew up" never look
 *  identical in the logs, and the skip/failure counts are machine-readable
 *  rather than living only in a free-text console.error line. */
interface PassCounts {
  claimed: number;
  executed: number;
  skipped: number;
  purged: number;
  failed: number;
}

/**
 * Reverts a claimed row back to `pending`. `pending` — not a new `failed`
 * enum value — is the only status that is TRUE when nothing happened to a
 * row: it keeps the user's cancel banner live, and `execute_after` being in
 * the past means the next pass claims and retries it. `executeDeletion` is
 * re-run-safe (the tombstone step is an upsert), so retrying is safe.
 *
 * That retry guarantee holds for every failure BEFORE the `users`-row delete
 * inside `executeDeletion` — which, since the N1 fix (`lib/account-deletion/erase.ts`),
 * is now that function's LAST step (ban, storage, tombstone, users — in that
 * order). Once that delete succeeds, `account_deletion_requests.user_id
 * references users(id) on delete cascade` takes the request row with it, and
 * there is nothing left here to revert. `.select("id")` below is the
 * belt-and-braces proof of that (review N1): it checks whether the UPDATE
 * actually matched a row rather than assuming it did, and logs a distinct
 * message when it did not, instead of promising a retry that can never
 * happen.
 *
 * Never throws (review N4): the whole body is wrapped, because this already
 * runs from inside a catch or a guard whose job is to keep the rest of the
 * pass moving — a further throw here would undo exactly that. Any failure,
 * including the row being gone, is logged loudly, never silently swallowed.
 *
 * Filters on `status = 'executed'`, not just `id` (review round 3 item 1):
 * without it, this UPDATE would happily flip a row an admin had since set to
 * `cancelled` (or any other status) back to `pending` — `id` alone isn't
 * enough to express "only touch the row I claimed."
 */
async function revertToPending(service: ServiceClient, requestId: string): Promise<void> {
  try {
    const { data, error } = await service
      .from("account_deletion_requests")
      .update({ status: "pending", executed_at: null })
      .eq("id", requestId)
      .eq("status", "executed")
      .select("id");
    if (error) {
      console.error(
        `[scheduler] account-deletion: FAILED to revert request ${requestId} back to pending ` +
          `after a failed/skipped attempt — it will incorrectly stay "executed" until fixed by hand`,
        error,
      );
      return;
    }
    if ((data ?? []).length === 0) {
      console.error(
        `[scheduler] account-deletion: request ${requestId} could not be reverted — it is no ` +
          `longer in "executed" status (either it cascaded away past the users-row delete, or ` +
          `an admin already changed it); nothing left to revert`,
      );
    }
  } catch (error) {
    console.error(
      `[scheduler] account-deletion: FAILED to revert request ${requestId} back to pending (threw)`,
      error,
    );
  }
}

/**
 * Un-bans a user after a failed/skipped `erase_all` attempt (review round 3
 * — the defect the N1 ban-first reorder introduced). `executeDeletion` bans
 * FIRST, so any failure reaching `processRow`'s catch may have left the
 * user banned with the deletion otherwise incomplete — and a banned GoTrue
 * user cannot obtain a session, so they cannot even reach `cancelDeletion`
 * to help themselves.
 *
 * ⚠️ NOT safe to call unconditionally, which is what the previous version of
 * this comment claimed (whole-branch review, I6 — and the fix is the guard
 * below, not a reworded comment). The one-live-request index is PARTIAL: it
 * forbids two *pending* rows, so `close_account`/`executed` coexisting with
 * `erase_all`/`pending` is representable at rest. A user who deliberately
 * closed their account, and later has a failed `erase_all` attempt, would
 * have that closure silently undone by an unconditional lift — their account
 * would simply be open again. After C1 the product states plainly that
 * closing is permanent, so silently reversing one is worse than it was.
 *
 * So: lift only when no OTHER executed `close_account` row exists for this
 * user. `neq("id", requestId)` excludes the row being processed right now —
 * a failing `close_account` row is itself `executed` (the claim sets it
 * before the work runs) and would otherwise match itself and block its own
 * legitimate lift.
 *
 * A failure of the CHECK itself does not lift: "we could not determine
 * whether this user deliberately closed their account" must not resolve to
 * "so re-open it". A user who stays banned can be helped by a human; a
 * closure silently reversed is a promise broken with nobody watching.
 *
 * Never throws, and never skipped on failure: this must not prevent the row
 * revert that follows it, but a failure here is the one case in this whole
 * job that genuinely needs a human — logged loudly with the user id, never
 * silently swallowed.
 */
async function liftBanAfterFailure(
  service: ServiceClient,
  userId: string,
  requestId: string,
): Promise<void> {
  try {
    const { data, error } = await service
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("tier", "close_account")
      .eq("status", "executed")
      .neq("id", requestId);
    if (error) {
      console.error(
        `[scheduler] account-deletion: could not check whether user ${userId} has a completed ` +
          `account closure — NOT lifting the ban, because re-opening a deliberately closed ` +
          `account is the worse mistake. They stay banned until a human looks.`,
        error,
      );
      return;
    }
    if ((data ?? []).length > 0) {
      console.info(
        `[scheduler] account-deletion: NOT lifting the ban on user ${userId} after a failed ` +
          `attempt — they have a completed close_account request, so the ban is deliberate and ` +
          `permanent. Only the deletion request itself is reverted.`,
      );
      return;
    }
    await liftBan(userId);
  } catch (error) {
    console.error(
      `[scheduler] account-deletion: FAILED to lift the ban on user ${userId} after a failed ` +
        `deletion attempt — they may be LOCKED OUT of their own account indefinitely (banned for ` +
        `~100 years, cannot sign in to cancel) until a human clears this by hand`,
      error,
    );
  }
}

/**
 * How long a row may sit in `executed` before it is treated as STRANDED
 * rather than in-flight. A single pass can legitimately take a while — the
 * Storage erase recurses and paginates — but not this long, and everything
 * else in this feature is measured in days, so there is a wide margin either
 * side of this number.
 */
const STRANDED_AFTER_MS = 15 * 60_000;

/**
 * ⚠️ I1 (whole-branch review): the claim marks a row `executed` BEFORE the
 * work runs, and every in-band failure is handled — `processRow`'s catch
 * lifts the ban and reverts the row. What is not handled is a SIGTERM, a
 * crash or a deploy restart landing between the claim and the catch. That
 * leaves an `erase_all` row `executed`, the user banned for ~100 years,
 * Storage possibly half-deleted, and the `users` row intact — and because
 * the claim only ever takes `status = 'pending'`, **nothing ever retries
 * it.** The GDPR erasure silently never completes, the statutory clock runs
 * out, and the user cannot sign in to ask why.
 *
 * This runs once at startup (`lib/scheduler/start.ts`), which is precisely
 * the moment after the crash that stranded the row.
 *
 * **Why `erase_all` only.** `account_deletion_requests.user_id references
 * users(id) on delete cascade`, and the `users` delete is `executeDeletion`'s
 * LAST step — so a COMPLETED `erase_all` takes its own request row with it.
 * An `erase_all` row still sitting in `executed` is therefore proof, by
 * itself, that the work did not finish. No separate "does the users row still
 * exist?" query is needed, and none is done: the FK already answers it.
 *
 * `close_account` is deliberately NOT reconciled, and that is not an
 * oversight. For that tier `executed` is the TERMINAL state and the `users`
 * row surviving is the intended outcome, so nothing distinguishes a completed
 * closure from a stranded one without asking GoTrue whether the ban landed.
 * Reverting them on age alone would re-claim and re-execute every closed
 * account, stamp a fresh `executed_at`, and do it all again N minutes later —
 * a perpetual re-ban loop for users who are already correctly closed. A
 * stranded `close_account` is also the mild case: the account simply is not
 * closed yet, nothing is destroyed, and nothing is on a statutory clock.
 *
 * Logs on every path, including "nothing stranded" — spec §7: a silent
 * scheduler cannot be distinguished from a dead one.
 *
 * @returns how many rows were reverted to `pending`.
 */
export async function reconcileStrandedDeletions(now: Date = new Date()): Promise<number> {
  const service = createServiceClient();
  const cutoff = new Date(now.getTime() - STRANDED_AFTER_MS).toISOString();

  const { data, error } = await service
    .from("account_deletion_requests")
    .select("id, user_id")
    .eq("status", "executed")
    .eq("tier", "erase_all")
    .lte("executed_at", cutoff);
  if (error) throw error;

  const stranded = (data ?? []) as unknown[];
  if (stranded.length === 0) {
    console.info("[scheduler] account-deletion reconciliation: no stranded rows");
    return 0;
  }

  let reverted = 0;
  for (const raw of stranded) {
    const parsed = strandedRowSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        "[scheduler] account-deletion reconciliation: malformed stranded row — skipping",
        parsed.error.flatten(),
      );
      continue;
    }
    console.error(
      `[scheduler] account-deletion reconciliation: request ${parsed.data.id} (user ` +
        `${parsed.data.user_id}) has been "executed" since before ${cutoff} but its users row ` +
        `still exists, so the erasure never completed — the process almost certainly died ` +
        `mid-deletion. Reverting to "pending" so the next pass retries it. Storage and the ban ` +
        `may be in a partial state; executeDeletion is re-run-safe.`,
    );
    await revertToPending(service, parsed.data.id);
    reverted += 1;
  }

  console.info("[scheduler] account-deletion reconciliation", {
    stranded: stranded.length,
    reverted,
  });
  return reverted;
}

/**
 * The claim is the work: one atomic UPDATE flips pending → executed and
 * RETURNS the rows it flipped, so two processes cannot claim the same
 * request. Never "select due, then update" — that races.
 *
 * Every claimed row's processing is independently try/caught (review C1): a
 * throw from one row (e.g. an incomplete Storage erase, which `erase.ts`
 * explicitly anticipates) reverts THAT row to pending and moves on, rather
 * than leaving every row claimed after it permanently stuck as `executed`
 * with no way to ever be retried.
 */
export const accountDeletionJob: ScheduledJob = {
  name: "account-deletion",
  async run(now: Date): Promise<number> {
    const service = createServiceClient();
    const counts: PassCounts = { claimed: 0, executed: 0, skipped: 0, purged: 0, failed: 0 };

    try {
      const { data, error } = await service
        .from("account_deletion_requests")
        .update({ status: "executed", executed_at: now.toISOString() })
        .eq("status", "pending")
        .lte("execute_after", now.toISOString())
        .select("id, user_id, tier, purge_after");
      if (error) throw error;

      const rawRows = (data ?? []) as unknown[];
      counts.claimed = rawRows.length;

      for (const raw of rawRows) {
        const parsed = dueRowSchema.safeParse(raw);
        if (!parsed.success) {
          // Not reachable through the app (Task 3 always writes a valid
          // pairing via scheduleFor) — reachable only through a forged
          // direct-PostgREST write, per the review. The row is already
          // claimed (status = executed); revert it rather than guessing.
          const rawId =
            typeof raw === "object" && raw !== null && "id" in raw && typeof (raw as { id: unknown }).id === "string"
              ? (raw as { id: string }).id
              : undefined;
          console.error(
            `[scheduler] account-deletion: claimed row ${rawId ?? "(no id)"} failed validation — skipping`,
            parsed.error.flatten(),
          );
          counts.skipped += 1;
          if (rawId) await revertToPending(service, rawId);
          continue;
        }

        await processRow(service, parsed.data, now, counts);
      }

      const { data: duePurges, error: purgeError } = await service
        .from("account_deletion_tombstones")
        .select("user_id")
        .lte("purge_after", now.toISOString());
      if (purgeError) throw purgeError;

      for (const rawPurgeRow of (duePurges ?? []) as unknown[]) {
        const parsedPurgeRow = duePurgeRowSchema.safeParse(rawPurgeRow);
        if (!parsedPurgeRow.success) {
          counts.failed += 1;
          console.error(
            "[scheduler] account-deletion: malformed tombstone row failed validation — skipping",
            parsedPurgeRow.error.flatten(),
          );
          continue;
        }
        await processPurgeRow(service, parsedPurgeRow.data, counts);
      }

      console.info("[scheduler] account-deletion pass", counts);
      return counts.executed + counts.purged;
    } catch (error) {
      console.error("[scheduler] account-deletion pass FAILED", counts, error);
      throw error;
    }
  },
};

/** One claimed, schema-valid row: branch on tier, execute, and update
 *  `counts` in place. Any throw from `executeDeletion` reverts this one row
 *  to pending and returns — it never escapes to abort the rows still
 *  waiting after it. Since `executeDeletion` bans FIRST (erase.ts N1), a
 *  throw here may have left `row.user_id` banned with the deletion
 *  otherwise incomplete — the ban is lifted before the revert (round 3),
 *  never after: a locked-out account is the more urgent problem than a row
 *  stuck as `executed`. */
async function processRow(service: ServiceClient, row: DueRow, now: Date, counts: PassCounts): Promise<void> {
  try {
    if (row.tier === "erase_all") {
      const purgeAfter = row.purge_after;
      if (purgeAfter === null) {
        // Should be impossible: scheduleFor always sets purge_after for
        // erase_all. The database has no CHECK tying tier to purge_after, so
        // this is the last line of defence — never guess a date, never force
        // it through executeDeletion (storage would already be gone by the
        // time the tombstone's NOT NULL rejects it).
        console.error(
          `[scheduler] account-deletion: request ${row.id} (user ${row.user_id}) is tier ` +
            `"erase_all" with a null purge_after — skipping, not executing. Reachable only via ` +
            `a forged direct write (Task 1 gap); needs a human to inspect the row.`,
        );
        counts.skipped += 1;
        await revertToPending(service, row.id);
        return;
      }
      await executeDeletion({ id: row.id, userId: row.user_id, tier: "erase_all", purgeAfter }, now);
    } else if (row.tier === "close_account") {
      await executeDeletion({ id: row.id, userId: row.user_id, tier: "close_account", purgeAfter: null }, now);
    } else {
      // Unreachable given the zod enum above (DELETION_TIERS has exactly
      // these two members) — kept as defence in depth (review m8) so a
      // future third tier added to the enum without updating this job fails
      // loud and reverts, rather than silently taking the non-erasing path
      // and being marked done.
      const unknownTier: never = row.tier;
      console.error(
        `[scheduler] account-deletion: request ${row.id} has unrecognized tier "${String(unknownTier)}" — skipping`,
      );
      counts.skipped += 1;
      await revertToPending(service, row.id);
      return;
    }
    counts.executed += 1;
  } catch (error) {
    counts.failed += 1;
    console.error(
      `[scheduler] account-deletion: request ${row.id} (user ${row.user_id}) FAILED — reverting to ` +
        `pending for retry`,
      error,
    );
    await liftBanAfterFailure(service, row.user_id, row.id);
    await revertToPending(service, row.id);
  }
}

/** One due tombstone row: purge the auth user, then delete the tombstone.
 *  Independently try/caught, same reasoning as `processRow` — one user's
 *  purge failing must not stop the rest of the purge loop. */
async function processPurgeRow(service: ServiceClient, row: DuePurgeRow, counts: PassCounts): Promise<void> {
  try {
    // Idempotent on "already gone" (erase.ts) — a retry after this very
    // loop's tombstone-delete failed on a prior pass converges instead of
    // throwing forever.
    await purgeAuthUser(row.user_id);
    const { error: deleteError } = await service
      .from("account_deletion_tombstones")
      .delete()
      .eq("user_id", row.user_id);
    if (deleteError) throw deleteError;
    counts.purged += 1;
  } catch (error) {
    counts.failed += 1;
    console.error(`[scheduler] account-deletion: purge failed for user ${row.user_id}`, error);
  }
}
