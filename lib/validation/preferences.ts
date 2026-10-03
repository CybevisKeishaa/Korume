import { z } from "zod";
import {
  DAILY_MINUTES_OPTIONS, DIFFICULTY_OPTIONS, DISPLAY_SCALE_OPTIONS, PLAYBACK_LOOP_COUNT_OPTIONS, PLAYBACK_RATE_OPTIONS, PRONUNCIATION_DURATION_OPTIONS, PRONUNCIATION_SORT_OPTIONS, READING_COLOR_PRESET_OPTIONS, READING_EMPHASIS_OPTIONS, READING_FURIGANA_OPTIONS, READING_JP_FONT_OPTIONS, READING_LINE_HEIGHT_OPTIONS, READING_TEXT_SIZE_OPTIONS, READING_TRANSLATION_OPTIONS, READING_WIDTH_OPTIONS, RESUME_BEHAVIOR_OPTIONS, REVIEW_FREQUENCY_OPTIONS, STUDY_ATMOSPHERE_OPTIONS,
  canonicalScheduleDays, type IsoWeekday,
} from "@/lib/preferences/options";

const day = z.number().int().min(1).max(7);

/**
 * One PATCH mutates one logical control (spec §3), so no request can
 * half-succeed across `users` and `user_preferences`. A union of strict
 * single-control objects: a mixed or two-control body matches no member.
 */
const schedule = z.discriminatedUnion("learningSchedule", [
  z.object({ learningSchedule: z.literal("every_day") }).strict(),
  z.object({ learningSchedule: z.literal("weekdays") }).strict(),
  z.object({ learningSchedule: z.literal("custom"), scheduleDays: z.array(day).min(1).max(7) }).strict(),
]).transform((value) => ({
  learningSchedule: value.learningSchedule,
  scheduleDays: canonicalScheduleDays(value.learningSchedule, "scheduleDays" in value ? value.scheduleDays : []),
}));

const dailyMinutes = z.object({
  dailyMinutes: z.number().refine((value) => (DAILY_MINUTES_OPTIONS as readonly number[]).includes(value)),
}).strict();

const pronunciationDisplay = z.object({
  pronunciationSort: z.enum(PRONUNCIATION_SORT_OPTIONS),
  pronunciationDuration: z.enum(PRONUNCIATION_DURATION_OPTIONS).nullable(),
  pronunciationHideCompleted: z.boolean(),
}).strict();

export const preferencesPatchSchema = z.union([
  dailyMinutes,
  schedule,
  z.object({ reviewFrequency: z.enum(REVIEW_FREQUENCY_OPTIONS) }).strict(),
  z.object({ difficulty: z.enum(DIFFICULTY_OPTIONS) }).strict(),
  z.object({ displayScale: z.enum(DISPLAY_SCALE_OPTIONS) }).strict(),
  z.object({ reduceMotion: z.boolean() }).strict(),
  z.object({ microphoneEnabled: z.boolean() }).strict(),
  z.object({ cameraEnabled: z.boolean() }).strict(),
  z.object({ companionEnabled: z.boolean() }).strict(),
  // The studio's panel always saves its whole view at once.
  pronunciationDisplay,
  z.object({ readingFurigana: z.enum(READING_FURIGANA_OPTIONS) }).strict(),
  z.object({ readingTranslation: z.enum(READING_TRANSLATION_OPTIONS) }).strict(),
  z.object({ readingJpFont: z.enum(READING_JP_FONT_OPTIONS) }).strict(),
  z.object({ readingTextSize: z.enum(READING_TEXT_SIZE_OPTIONS) }).strict(),
  z.object({ readingLineHeight: z.enum(READING_LINE_HEIGHT_OPTIONS) }).strict(),
  z.object({ readingWidth: z.enum(READING_WIDTH_OPTIONS) }).strict(),
  z.object({ readingEmphasis: z.enum(READING_EMPHASIS_OPTIONS) }).strict(),
  z.object({ readingColorPreset: z.enum(READING_COLOR_PRESET_OPTIONS) }).strict(),
  z.object({ playbackDefaultRate: z.number().refine((value) => (PLAYBACK_RATE_OPTIONS as readonly number[]).includes(value)) }).strict(),
  z.object({ playbackLoopCount: z.number().refine((value) => (PLAYBACK_LOOP_COUNT_OPTIONS as readonly number[]).includes(value)) }).strict(),
  z.object({ playbackAutoPause: z.boolean() }).strict(),
  z.object({ showShortcutHints: z.boolean() }).strict(),
  z.object({ resumeBehavior: z.enum(RESUME_BEHAVIOR_OPTIONS) }).strict(),
  z.object({ studyAtmosphere: z.enum(STUDY_ATMOSPHERE_OPTIONS) }).strict(),
]);

export type PreferencesPatch = z.output<typeof preferencesPatchSchema>;
export type { IsoWeekday };
