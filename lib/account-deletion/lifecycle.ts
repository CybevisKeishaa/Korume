/**
 * The deletion lifecycle, as pure arithmetic — no IO, no clock of its own.
 * Both tiers share it (spec §3): two mechanisms would be two chances to get
 * the grace window wrong.
 */

export const GRACE_DAYS = 7;
export const PURGE_DAYS = 90;

export type DeletionTier = "close_account" | "erase_all";
export type DeletionStatus = "pending" | "cancelled" | "executed" | "purged";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `purgeAfter` is measured from the REQUEST, not from execution: the 90 days
 *  a deleted email stays reserved is a promise made when the user asks. */
export function scheduleFor(
  tier: DeletionTier,
  requestedAt: Date,
): { executeAfter: Date; purgeAfter: Date | null } {
  return {
    executeAfter: new Date(requestedAt.getTime() + GRACE_DAYS * DAY_MS),
    purgeAfter: tier === "erase_all" ? new Date(requestedAt.getTime() + PURGE_DAYS * DAY_MS) : null,
  };
}

export function canCancel(status: DeletionStatus): boolean {
  return status === "pending";
}

export function isDue(executeAfter: Date, now: Date): boolean {
  return now.getTime() >= executeAfter.getTime();
}
