import type {
  BadgeEarnedPayload,
  LevelUpPayload,
  NotificationRow,
  SrsDuePayload,
} from "./notification-types";

function isBadgeEarnedPayload(payload: unknown): payload is BadgeEarnedPayload {
  const p = payload as Partial<BadgeEarnedPayload> | null;
  return !!p && typeof p.badgeName === "string";
}

function isLevelUpPayload(payload: unknown): payload is LevelUpPayload {
  const p = payload as Partial<LevelUpPayload> | null;
  return !!p && typeof p.level === "number";
}

function isSrsDuePayload(payload: unknown): payload is SrsDuePayload {
  const p = payload as Partial<SrsDuePayload> | null;
  return !!p && typeof p.dueCount === "number";
}

/**
 * Human-readable text for one notification, narrowed per `type` (Layer 6 UI
 * task). The payload's shape is guaranteed server-side by the `notifications`
 * table's check constraint, but this still defensively validates before
 * rendering — a malformed/unexpected payload degrades to a generic message
 * instead of crashing the bell panel.
 */
export function describeNotification(notification: NotificationRow): string {
  switch (notification.type) {
    case "badge_earned":
      return isBadgeEarnedPayload(notification.payload)
        ? `You earned ${notification.payload.badgeName}`
        : "You have a new notification";
    case "level_up":
      return isLevelUpPayload(notification.payload)
        ? `You reached Level ${notification.payload.level}`
        : "You have a new notification";
    case "srs_due":
      return isSrsDuePayload(notification.payload)
        ? `${notification.payload.dueCount} cards are due`
        : "You have a new notification";
    default:
      return "You have a new notification";
  }
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Short relative time for the notification list ("15m ago", "3d ago"),
 * falling back to an absolute short date beyond a week so old notifications
 * don't read as a vague "52w ago". `now` is injectable for deterministic
 * tests, matching the `lib/srs`/`lib/gamification` convention.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();

  if (diffMs < MINUTE_MS) return "just now";
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m ago`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}h ago`;
  if (diffMs < WEEK_MS) return `${Math.floor(diffMs / DAY_MS)}d ago`;

  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
