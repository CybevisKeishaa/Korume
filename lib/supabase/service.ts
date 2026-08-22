import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, requiredEnv } from "@/lib/env";

/**
 * Service-role Supabase client — **bypasses RLS entirely**.
 *
 * ⚠️ This comment used to enumerate a closed set of permitted consumers
 * (`video_summaries` and the `ai_generated` rows in `vocab_examples`). That
 * enumeration was false long before this branch and is unmaintainable by
 * construction — it is a second home for a fact that only the import graph
 * actually knows (CLAUDE.md §6), and a comment claiming a guarantee the code
 * does not make is worse than no comment. Count the real consumers instead of
 * trusting any list, here or anywhere:
 *
 *   grep -rln "createServiceClient" lib/ app/
 *
 * What holds regardless of how long that list gets — the RULES, which is what
 * belongs here:
 *
 * 1. **This client re-checks nothing.** Not visibility, not ownership, not
 *    that the referenced row exists. Every caller must have established those
 *    itself BEFORE reaching for this — typically by deriving the user id from
 *    `requireUser`, never from a request body.
 * 2. **Reach for it only where an `authenticated` write policy deliberately
 *    does not exist** — an admin-only surface, a background job with no
 *    session at all, or a write whose parameters the client must not be able
 *    to choose. `lib/data/account-deletion.ts`'s `requestDeletion` is the
 *    clearest example of the third: it writes through this client precisely so
 *    `authenticated` can hold no INSERT grant, because that grant let a caller
 *    name its own `execute_after` and skip the 7-day cancellation window
 *    entirely (migration `20260820000031`).
 * 3. **Never import it into a route handler.** Routes go through the module
 *    that owns the operation (`lib/data/*`, `lib/admin/*`, `lib/scheduler/*`),
 *    which is where the auth and rate-limit checks live. This one is a
 *    convention, not a lint rule — there is no enforcement behind it today,
 *    so it is stated as the rule it is rather than as a guarantee.
 */
export function createServiceClient(): SupabaseClient {
  return createSupabaseClient(publicEnv.supabaseUrl(), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
