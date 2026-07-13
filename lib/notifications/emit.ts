import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverInApp } from "./deliver-in-app";
import type { NotificationEvent } from "./types";

type Deliverer = (client: SupabaseClient, event: NotificationEvent) => Promise<void>;

/**
 * Every registered deliverer, run in order for every event. Adding a new
 * channel later (e.g. email/push) means adding one function here — business
 * code that raises events never changes.
 */
const deliverers: Deliverer[] = [deliverInApp];

/**
 * Fan a business event out to every registered deliverer. Business code
 * (the gamification award pipeline) calls this and nothing else — it never
 * knows delivery is "in-app only" today. Errors propagate to the caller;
 * `lib/data/gamification.ts` wraps its own call site so a delivery failure
 * never breaks the learning-flow request that triggered it.
 */
export async function emitNotification(client: SupabaseClient, event: NotificationEvent): Promise<void> {
  for (const deliver of deliverers) {
    await deliver(client, event);
  }
}
