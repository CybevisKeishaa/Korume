/**
 * Notification event vs delivery separation (Layer 6). Business code — the
 * gamification award pipeline (`lib/data/gamification.ts`) today, more
 * sources later — only ever constructs a `NotificationEvent` and hands it to
 * `emitNotification`; it never knows or cares how/where a notification is
 * actually delivered. Per product principle G3
 * (docs/product/business-model.md §1.1): notifications support learning, not
 * attention — so this stays deliberately small: one delivery channel
 * (in-app inbox), no queues, no retries, no channel speculation.
 *
 * Pure types only — no runtime logic lives here.
 */

export interface BadgeEarnedPayload {
  badgeId: string;
  badgeName: string;
}

export interface LevelUpPayload {
  level: number;
}

export interface SrsDuePayload {
  dueCount: number;
}

/**
 * One event a business flow can raise. `type` mirrors the `notifications.type`
 * check constraint exactly (migration 20260713000013_gamification.sql) — keep
 * the two in sync if a new event type is ever added.
 */
export type NotificationEvent =
  | { type: "badge_earned"; userId: string; payload: BadgeEarnedPayload }
  | { type: "level_up"; userId: string; payload: LevelUpPayload }
  | { type: "srs_due"; userId: string; payload: SrsDuePayload };
