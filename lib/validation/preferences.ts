import { z } from "zod";
import {
  DAILY_MINUTES_OPTIONS, DIFFICULTY_OPTIONS, DISPLAY_SCALE_OPTIONS, REVIEW_FREQUENCY_OPTIONS,
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

export const preferencesPatchSchema = z.union([
  dailyMinutes,
  schedule,
  z.object({ reviewFrequency: z.enum(REVIEW_FREQUENCY_OPTIONS) }).strict(),
  z.object({ difficulty: z.enum(DIFFICULTY_OPTIONS) }).strict(),
  z.object({ displayScale: z.enum(DISPLAY_SCALE_OPTIONS) }).strict(),
  z.object({ reduceMotion: z.boolean() }).strict(),
  z.object({ microphoneEnabled: z.boolean() }).strict(),
  z.object({ cameraEnabled: z.boolean() }).strict(),
]);

export type PreferencesPatch = z.output<typeof preferencesPatchSchema>;
export type { IsoWeekday };
