/**
 * Client-safe mirror of `lib/data/notifications.ts`'s `NotificationRow` /
 * `NotificationsPage` (that module is `server-only`) — same shapes returned
 * by `GET /api/notifications`, just declared locally so client components
 * (the notification bell) can import the type without pulling in the data
 * layer. Same duplication convention as `lib/video-types.ts` vs
 * `lib/data/videos.ts`.
 */
export type { BadgeEarnedPayload, LevelUpPayload, SrsDuePayload } from "@/lib/notifications/types";

export type NotificationType = "badge_earned" | "level_up" | "srs_due";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  notifications: NotificationRow[];
  unreadCount: number;
}
