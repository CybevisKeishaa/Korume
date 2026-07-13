import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationEvent } from "./types";

/**
 * The single notification deliverer today: writes one row to the in-app
 * `notifications` inbox. `client` is dependency-injected (service-role in
 * production — writes are service-role-only per migration
 * 20260713000013_gamification.sql — a mock in tests) rather than constructed
 * here, so this stays a pure "shape a row, insert it" function with no
 * client-creation responsibility of its own.
 */
export async function deliverInApp(client: SupabaseClient, event: NotificationEvent): Promise<void> {
  const { error } = await client.from("notifications").insert({
    user_id: event.userId,
    type: event.type,
    payload: event.payload,
  });
  if (error) throw error;
}
