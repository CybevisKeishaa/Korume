import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, requiredEnv } from "@/lib/env";

/**
 * Service-role Supabase client — bypasses RLS entirely. Use ONLY for the
 * narrow set of server-side writes that deliberately have no `authenticated`
 * write policy: `video_summaries` and the `ai_generated` rows in
 * `vocab_examples` (see migration 20260712000010_ai_features.sql). The
 * Anthropic call that produces the data to insert must already have
 * succeeded and the referenced row (video/vocab id) must already be
 * validated by the time this client is used — it does not re-check
 * visibility/ownership for you.
 *
 * Never import this into a route handler directly; go through the `lib/data`
 * function that owns the specific insert.
 */
export function createServiceClient(): SupabaseClient {
  return createSupabaseClient(publicEnv.supabaseUrl(), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
