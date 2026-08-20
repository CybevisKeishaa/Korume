import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { executeDeletion, purgeAuthUser } from "@/lib/account-deletion/erase";
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
 */
async function revertToPending(service: ServiceClient, requestId: string): Promise<void> {
  try {
    const { data, error } = await service
      .from("account_deletion_requests")
      .update({ status: "pending", executed_at: null })
      .eq("id", requestId)
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
        `[scheduler] account-deletion: request ${requestId} no longer exists — deletion was ` +
          `already irreversible past the users-row delete; there is nothing left to revert`,
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
 *  `counts` in place. Any throw from `executeDeletion` (or the null-`purge_after`
 *  guard) reverts this one row to pending and returns — it never escapes to
 *  abort the rows still waiting after it. */
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
