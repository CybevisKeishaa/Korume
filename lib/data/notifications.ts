import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import type { MarkNotificationsReadInput, NotificationsQuery } from "@/lib/validation/notifications";

/**
 * In-app notification inbox (Layer 6 — badge_earned/level_up/srs_due; see
 * lib/notifications/types.ts for the event shapes and
 * 20260713000013_gamification.sql for the table). Notifications are written
 * server-side only (service role, via lib/notifications/deliver-in-app.ts);
 * this module is the read + "mark read" side, using the normal RLS-scoped
 * client like the rest of `lib/data/*`.
 */

const MARK_READ_LIMIT = { limit: 30, windowMs: 60_000 };

export interface NotificationRow {
  id: string;
  type: "badge_earned" | "level_up" | "srs_due";
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  notifications: NotificationRow[];
  unreadCount: number;
}

export type ListNotificationsResult = { ok: true; data: NotificationsPage } | { ok: false; status: 401 };

interface RawNotificationRow {
  id: string;
  type: "badge_earned" | "level_up" | "srs_due";
  payload: unknown;
  read_at: string | null;
  created_at: string;
}

/**
 * The current user's most recent notifications (newest first, capped at
 * `query.limit`) plus the total unread count.
 *
 * The unread count is a second, separate `select("id")` filtered on
 * `read_at is null` rather than a `{count:'exact', head:true}` aggregate —
 * simpler to reason about for an inbox-sized table, and the filter itself is
 * exactly what `idx_notifications_user_unread` (the partial index on
 * `read_at is null`) exists to serve, aggregate or not.
 */
export async function listNotifications(query: NotificationsQuery): Promise<ListNotificationsResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(query.limit);
  if (error) throw error;

  const { data: unreadRows, error: unreadError } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", user.id)
    .is("read_at", null);
  if (unreadError) throw unreadError;

  const notifications: NotificationRow[] = ((data as RawNotificationRow[] | null) ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));

  return {
    ok: true,
    data: { notifications, unreadCount: ((unreadRows as { id: string }[] | null) ?? []).length },
  };
}

export type MarkNotificationsReadResult =
  | { ok: true; data: { updated: number } }
  | { ok: false; status: 401 | 400 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Mark notifications read for the current user. `{ all: true }` clears every
 * unread notification; `{ ids }` clears only the given ones (still scoped to
 * the caller's own unread rows — RLS plus the `read_at`-only column grant
 * from 20260713000013_gamification.sql make this safe with the normal
 * client). `updated` is the number of rows the update actually touched,
 * read back cheaply via `.select()` chained onto the same update.
 */
export async function markNotificationsRead(
  input: MarkNotificationsReadInput,
): Promise<MarkNotificationsReadResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`notifications:mark-read:${user.id}`, MARK_READ_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if ("ids" in input) {
    query = query.in("id", input.ids);
  }

  const { data, error } = await query.select("id");
  if (error) return { ok: false, status: 400 };

  return { ok: true, data: { updated: ((data as { id: string }[] | null) ?? []).length } };
}
