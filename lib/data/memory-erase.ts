import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Three an hour. Erasing is idempotent and destroys nothing a second call
 * could destroy again, so the limit is not protecting data — it is bounding
 * how often one caller can make the server run two cascading deletes.
 */
const ERASE_LIMIT = { limit: 3, windowMs: 60 * 60_000 };

export type EraseMyMemoryResult =
  | { ok: true; data: { erased: true } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Erase Korume Memory (spec §4.8): the companion diary and every conversation
 * session, together, for the caller only. Learning progress is untouched —
 * nothing under `user_*_progress`, `user_stats`, `xp_events` or badges is in
 * the function's reach, and the live gate (`npm run verify:db:settings`)
 * proves it against a real database rather than against this comment.
 *
 * The delete is ONE `erase_companion_memory()` call, not two `.delete()`
 * chains from here, for two reasons that are both load-bearing: the two
 * deletes commit together, so there is no window where the diary is gone and
 * the conversations remain; and the function is `security invoker`, so the
 * existing owner-only delete policies on `companion_memories` and
 * `conversation_sessions` are what scope it to `auth.uid()`. This layer never
 * sends a user id — it cannot widen the blast radius even if it tried.
 * `conversation_messages` goes with its session through `on delete cascade`.
 *
 * Unlike `readPreferences`, this THROWS on an unexpected database failure
 * rather than degrading: "we could not erase your memory" and "we erased your
 * memory" are not interchangeable, and the route turns the throw into an
 * opaque 500. Reporting `ok` on a failed delete would be the worse bug.
 */
export async function eraseMyMemory(now: Date = new Date()): Promise<EraseMyMemoryResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`memory-erase:${user.id}`, ERASE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { error } = await supabase.rpc("erase_companion_memory");
  if (error) throw error;

  return { ok: true, data: { erased: true } };
}
