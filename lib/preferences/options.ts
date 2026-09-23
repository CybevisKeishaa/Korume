/** The one home of every Settings option list (spec §3). Zod, UI and the migration test import these. */
export const LEARNING_SCHEDULE_OPTIONS = ["every_day", "weekdays", "custom"] as const;
export const REVIEW_FREQUENCY_OPTIONS = ["normal", "more", "relaxed"] as const;
export const DIFFICULTY_OPTIONS = ["adaptive", "easy", "challenge"] as const;
export const DISPLAY_SCALE_OPTIONS = ["normal", "large", "extra_large"] as const;
export const DAILY_MINUTES_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const;

export type LearningSchedule = (typeof LEARNING_SCHEDULE_OPTIONS)[number];
export type ReviewFrequency = (typeof REVIEW_FREQUENCY_OPTIONS)[number];
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];
export type DisplayScale = (typeof DISPLAY_SCALE_OPTIONS)[number];
/** ISO weekday, Monday = 1 … Sunday = 7, taken from the VN-local date (spec §4.3). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ALL_DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5];

export interface UserPreferences {
  learningSchedule: LearningSchedule;
  scheduleDays: IsoWeekday[];
  reviewFrequency: ReviewFrequency;
  difficulty: Difficulty;
  displayScale: DisplayScale;
  reduceMotion: boolean;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  /** Lives on `users.daily_minutes`; carried here so one read serves the page. */
  dailyMinutes: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  learningSchedule: "every_day",
  scheduleDays: [...ALL_DAYS],
  reviewFrequency: "normal",
  difficulty: "adaptive",
  displayScale: "normal",
  reduceMotion: false,
  microphoneEnabled: true,
  cameraEnabled: false,
  dailyMinutes: 15,
};

export function canonicalScheduleDays(schedule: LearningSchedule, days: readonly number[]): IsoWeekday[] {
  if (schedule === "every_day") return [...ALL_DAYS];
  if (schedule === "weekdays") return [...WEEKDAYS];
  return [...new Set(days)].sort((a, b) => a - b) as IsoWeekday[];
}

export const DISPLAY_SCALE_FACTOR: Record<DisplayScale, number> = {
  normal: 1,
  large: 1.125,
  extra_large: 1.25,
};
