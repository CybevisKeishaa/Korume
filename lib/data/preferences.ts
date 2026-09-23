import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_PREFERENCES, type IsoWeekday, type UserPreferences } from "@/lib/preferences/options";
import type { PreferencesPatch } from "@/lib/validation/preferences";

type Supabase = ReturnType<typeof createClient>;
const WRITE_LIMIT = { limit: 30, windowMs: 60_000 };

interface PreferencesRow {
  learning_schedule: UserPreferences["learningSchedule"];
  schedule_days: number[];
  review_frequency: UserPreferences["reviewFrequency"];
  difficulty: UserPreferences["difficulty"];
  display_scale: UserPreferences["displayScale"];
  reduce_motion: boolean;
  microphone_enabled: boolean;
  camera_enabled: boolean;
}

const COLUMNS =
  "learning_schedule, schedule_days, review_frequency, difficulty, display_scale, reduce_motion, microphone_enabled, camera_enabled";

function fromRow(row: PreferencesRow | null, dailyMinutes: number): UserPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES, dailyMinutes };
  return {
    learningSchedule: row.learning_schedule,
    scheduleDays: row.schedule_days as IsoWeekday[],
    reviewFrequency: row.review_frequency,
    difficulty: row.difficulty,
    displayScale: row.display_scale,
    reduceMotion: row.reduce_motion,
    microphoneEnabled: row.microphone_enabled,
    cameraEnabled: row.camera_enabled,
    dailyMinutes,
  };
}

/**
 * Engines and layouts call this on hot paths, so it never throws: any failure
 * yields the defaults, which are the behaviour every user had before this
 * branch (normal intervals, adaptive band, every-day streak, scale 1).
 */
export async function readPreferences(supabase: Supabase, userId: string): Promise<UserPreferences> {
  try {
    const [prefs, user] = await Promise.all([
      supabase.from("user_preferences").select(COLUMNS).eq("user_id", userId).maybeSingle(),
      supabase.from("users").select("daily_minutes").eq("id", userId).maybeSingle(),
    ]);
    if (prefs.error) throw prefs.error;
    if (user.error) throw user.error;
    const dailyMinutes = (user.data as { daily_minutes: number } | null)?.daily_minutes ?? DEFAULT_PREFERENCES.dailyMinutes;
    return fromRow(prefs.data as PreferencesRow | null, dailyMinutes);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only.
    console.error("[data/preferences] readPreferences failed:", error);
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function getMyPreferences(): Promise<UserPreferences | null> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return null;
  return readPreferences(supabase, user.id);
}

export type UpdatePreferencesResult =
  | { ok: true; data: UserPreferences }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Keyed by the preference union, not by `string`: adding a field to
 * `UserPreferences` without a column here is a compile error rather than a
 * PATCH that returns 200 and saves nothing.
 */
const TO_COLUMN: Record<Exclude<keyof UserPreferences, "dailyMinutes">, string> = {
  learningSchedule: "learning_schedule",
  scheduleDays: "schedule_days",
  reviewFrequency: "review_frequency",
  difficulty: "difficulty",
  displayScale: "display_scale",
  reduceMotion: "reduce_motion",
  microphoneEnabled: "microphone_enabled",
  cameraEnabled: "camera_enabled",
};

export async function updateMyPreferences(
  patch: PreferencesPatch,
  now: Date = new Date(),
): Promise<UpdatePreferencesResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`preferences:${user.id}`, WRITE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  if ("dailyMinutes" in patch) {
    const { error } = await supabase.from("users").update({ daily_minutes: patch.dailyMinutes }).eq("id", user.id);
    if (error) throw error;
  } else {
    const row: Record<string, unknown> = { user_id: user.id, updated_at: now.toISOString() };
    // The schema is a union of `.strict()` objects, so every key is mapped.
    for (const [key, value] of Object.entries(patch)) {
      row[TO_COLUMN[key as keyof typeof TO_COLUMN]] = value;
    }
    const { error } = await supabase.from("user_preferences").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
  }
  return { ok: true, data: await readPreferences(supabase, user.id) };
}
