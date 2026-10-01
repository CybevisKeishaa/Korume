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
  pronunciation_sort: UserPreferences["pronunciationSort"];
  pronunciation_duration: NonNullable<UserPreferences["pronunciationDuration"]> | null;
  pronunciation_hide_completed: boolean;
  reading_furigana: UserPreferences["readingFurigana"];
  reading_translation: UserPreferences["readingTranslation"];
  reading_jp_font: UserPreferences["readingJpFont"];
  reading_text_size: UserPreferences["readingTextSize"];
  reading_line_height: UserPreferences["readingLineHeight"];
  reading_width: UserPreferences["readingWidth"];
  reading_emphasis: UserPreferences["readingEmphasis"];
  reading_color_preset: UserPreferences["readingColorPreset"];
  playback_default_rate: number | string;
  playback_loop_count: UserPreferences["playbackLoopCount"];
  playback_auto_pause: boolean;
  show_shortcut_hints: boolean;
  resume_behavior: UserPreferences["resumeBehavior"];
  study_atmosphere: UserPreferences["studyAtmosphere"];
}

const COLUMNS =
  "learning_schedule, schedule_days, review_frequency, difficulty, display_scale, reduce_motion, microphone_enabled, camera_enabled, pronunciation_sort, pronunciation_duration, pronunciation_hide_completed, reading_furigana, reading_translation, reading_jp_font, reading_text_size, reading_line_height, reading_width, reading_emphasis, reading_color_preset, playback_default_rate, playback_loop_count, playback_auto_pause, show_shortcut_hints, resume_behavior, study_atmosphere";

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
    pronunciationSort: row.pronunciation_sort,
    pronunciationDuration: row.pronunciation_duration,
    pronunciationHideCompleted: row.pronunciation_hide_completed,
    readingFurigana: row.reading_furigana,
    readingTranslation: row.reading_translation,
    readingJpFont: row.reading_jp_font,
    readingTextSize: row.reading_text_size,
    readingLineHeight: row.reading_line_height,
    readingWidth: row.reading_width,
    readingEmphasis: row.reading_emphasis,
    readingColorPreset: row.reading_color_preset,
    playbackDefaultRate: Number(row.playback_default_rate) as UserPreferences["playbackDefaultRate"],
    playbackLoopCount: row.playback_loop_count,
    playbackAutoPause: row.playback_auto_pause,
    showShortcutHints: row.show_shortcut_hints,
    resumeBehavior: row.resume_behavior,
    studyAtmosphere: row.study_atmosphere,
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
    return await readPreferencesOrThrow(supabase, userId);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only.
    console.error("[data/preferences] readPreferences failed:", error);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * The same read, failing loud.
 *
 * ⚠️ Use this wherever the defaults would be a LIE rather than a fallback.
 * After a write has committed, `readPreferences` swallowing the read error and
 * answering `DEFAULT_PREFERENCES` produces a `200` that says the user's new
 * value is the default — and `usePreferenceSave` believes the response over
 * its own optimistic value, writing it into the UI and into `confirmed`. The
 * control snaps back while the database holds the new value, and the reset
 * `dailyMinutes` rides along with it.
 *
 * A missing row is NOT an error: `fromRow(null, ...)` is how a user with no
 * preferences row gets the defaults, and that path still returns normally.
 */
export async function readPreferencesOrThrow(
  supabase: Supabase,
  userId: string,
): Promise<UserPreferences> {
  const [prefs, user] = await Promise.all([
    supabase.from("user_preferences").select(COLUMNS).eq("user_id", userId).maybeSingle(),
    supabase.from("users").select("daily_minutes").eq("id", userId).maybeSingle(),
  ]);
  if (prefs.error) throw prefs.error;
  if (user.error) throw user.error;
  const dailyMinutes = (user.data as { daily_minutes: number } | null)?.daily_minutes ?? DEFAULT_PREFERENCES.dailyMinutes;
  return fromRow(prefs.data as PreferencesRow | null, dailyMinutes);
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
  pronunciationSort: "pronunciation_sort",
  pronunciationDuration: "pronunciation_duration",
  pronunciationHideCompleted: "pronunciation_hide_completed",
  readingFurigana: "reading_furigana",
  readingTranslation: "reading_translation",
  readingJpFont: "reading_jp_font",
  readingTextSize: "reading_text_size",
  readingLineHeight: "reading_line_height",
  readingWidth: "reading_width",
  readingEmphasis: "reading_emphasis",
  readingColorPreset: "reading_color_preset",
  playbackDefaultRate: "playback_default_rate",
  playbackLoopCount: "playback_loop_count",
  playbackAutoPause: "playback_auto_pause",
  showShortcutHints: "show_shortcut_hints",
  resumeBehavior: "resume_behavior",
  studyAtmosphere: "study_atmosphere",
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
  // Deliberately the throwing read: the write has COMMITTED by now, so the
  // defaults would be a false report of what the database holds.
  return { ok: true, data: await readPreferencesOrThrow(supabase, user.id) };
}
