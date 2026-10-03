import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { readPreferencesOrThrow } from "@/lib/data/preferences";

export type KorumeGate =
  | { kind: "unauthorized" }
  | { kind: "disabled" }
  /** Preferences could not be read. Fail closed: a DB hiccup must never read as "enabled" (plan Correction 6). */
  | { kind: "unavailable" }
  | { kind: "ok"; supabase: ReturnType<typeof createClient>; userId: string };

/**
 * Every `/api/korume/*` handler starts here: auth first (a signed-out caller learns nothing about the
 * setting), then the learner's `companion_enabled` (spec §3.5). Uses the throwing reader on purpose —
 * `readPreferences` answers the defaults on error, and the default is `true`.
 */
export async function korumeGate(): Promise<KorumeGate> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { kind: "unauthorized" };
  try {
    const preferences = await readPreferencesOrThrow(supabase, user.id);
    return preferences.companionEnabled ? { kind: "ok", supabase, userId: user.id } : { kind: "disabled" };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only.
    console.error("[korume/gate] preferences read failed:", error);
    return { kind: "unavailable" };
  }
}
