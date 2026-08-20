import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { executeDeletion, purgeAuthUser } from "@/lib/account-deletion/erase";
import type { ScheduledJob } from "../registry";
import type { DeletionTier } from "@/lib/account-deletion/lifecycle";

interface DueRow {
  id: string;
  user_id: string;
  tier: DeletionTier;
  purge_after: string | null;
}

/**
 * The claim is the work: one atomic UPDATE flips pending → executed and
 * RETURNS the rows it flipped, so two processes cannot claim the same
 * request. Never "select due, then update" — that races.
 */
export const accountDeletionJob: ScheduledJob = {
  name: "account-deletion",
  async run(now: Date): Promise<number> {
    const service = createServiceClient();

    const { data, error } = await service
      .from("account_deletion_requests")
      .update({ status: "executed", executed_at: now.toISOString() })
      .eq("status", "pending")
      .lte("execute_after", now.toISOString())
      .select("id, user_id, tier, purge_after");
    if (error) throw error;

    const claimed = (data ?? []) as DueRow[];
    let handled = 0;

    for (const row of claimed) {
      if (row.tier === "erase_all") {
        const purgeAfter = row.purge_after;
        if (purgeAfter === null) {
          // Should be impossible: Task 3 always computes purge_after
          // server-side via scheduleFor before inserting the request, and
          // scheduleFor gives every "erase_all" row a non-null purge_after.
          // But the database has no CHECK constraint tying tier to
          // purge_after, so a bad row is representable at rest even though
          // the app never writes one. The row was only just claimed above —
          // status flipped to "executed", nothing destructive has run — so
          // the safe move is to leave it exactly there for a human to
          // inspect, not to guess a purge date or force it through
          // executeDeletion (which would erase storage and then throw a
          // NOT NULL violation on the tombstone, per the Task 5 review).
          // One malformed row must not stop every other user's deletion.
          console.error(
            `[scheduler] account-deletion: request ${row.id} (user ${row.user_id}) is ` +
              `tier "erase_all" with a null purge_after — skipping, not executing. ` +
              `This should not be reachable through the app; needs a human to inspect the row.`,
          );
          continue;
        }
        await executeDeletion(
          { id: row.id, userId: row.user_id, tier: "erase_all", purgeAfter },
          now,
        );
      } else {
        await executeDeletion(
          { id: row.id, userId: row.user_id, tier: "close_account", purgeAfter: null },
          now,
        );
      }
      handled += 1;
    }

    const { data: duePurges, error: purgeError } = await service
      .from("account_deletion_tombstones")
      .select("user_id")
      .lte("purge_after", now.toISOString());
    if (purgeError) throw purgeError;

    for (const row of (duePurges ?? []) as { user_id: string }[]) {
      await purgeAuthUser(row.user_id);
      await service.from("account_deletion_tombstones").delete().eq("user_id", row.user_id);
      handled += 1;
    }

    return handled;
  },
};
