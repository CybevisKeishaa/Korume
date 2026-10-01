/** The one home of every Settings option list (spec §3). Zod, UI and the migration test import these. */
export const LEARNING_SCHEDULE_OPTIONS = ["every_day", "weekdays", "custom"] as const;
export const REVIEW_FREQUENCY_OPTIONS = ["normal", "more", "relaxed"] as const;
export const DIFFICULTY_OPTIONS = ["adaptive", "easy", "challenge"] as const;
export const DISPLAY_SCALE_OPTIONS = ["normal", "large", "extra_large"] as const;
export const PRONUNCIATION_SORT_OPTIONS = ["recommended", "newest", "shortest", "in_progress"] as const;
export const PRONUNCIATION_DURATION_OPTIONS = ["under_10", "10_30", "over_30"] as const;
export const DAILY_MINUTES_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const;
export const READING_FURIGANA_OPTIONS = ["always", "adaptive", "hidden"] as const;
export const READING_TRANSLATION_OPTIONS = ["hidden", "reveal", "always"] as const;
export const READING_JP_FONT_OPTIONS = ["gothic", "mincho"] as const;
export const READING_TEXT_SIZE_OPTIONS = ["s", "m", "l", "xl"] as const;
export const READING_LINE_HEIGHT_OPTIONS = ["compact", "comfortable", "airy"] as const;
export const READING_WIDTH_OPTIONS = ["narrow", "normal", "wide"] as const;
export const READING_EMPHASIS_OPTIONS = ["minimal", "soft", "strong"] as const;
export const READING_COLOR_PRESET_OPTIONS = ["warm_cream", "night", "sepia", "high_contrast"] as const;
export const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
/** 0 = ∞ (repeat until the learner changes sentence or turns loop off). */
export const PLAYBACK_LOOP_COUNT_OPTIONS = [1, 3, 5, 0] as const;
export const RESUME_BEHAVIOR_OPTIONS = ["resume", "restart"] as const;
export const STUDY_ATMOSPHERE_OPTIONS = [
  "none", "evening_study", "coffee_shop", "rainy_day", "quiet_library", "spring_morning", "summer_night",
] as const;
export const SENTENCE_MARK_KINDS = ["bookmark", "difficult"] as const;

export type LearningSchedule = (typeof LEARNING_SCHEDULE_OPTIONS)[number];
export type ReviewFrequency = (typeof REVIEW_FREQUENCY_OPTIONS)[number];
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];
export type DisplayScale = (typeof DISPLAY_SCALE_OPTIONS)[number];
export type PronunciationSort = (typeof PRONUNCIATION_SORT_OPTIONS)[number];
export type PronunciationDuration = (typeof PRONUNCIATION_DURATION_OPTIONS)[number] | null;
export type ReadingFurigana = (typeof READING_FURIGANA_OPTIONS)[number];
export type ReadingTranslation = (typeof READING_TRANSLATION_OPTIONS)[number];
export type ReadingJpFont = (typeof READING_JP_FONT_OPTIONS)[number];
export type ReadingTextSize = (typeof READING_TEXT_SIZE_OPTIONS)[number];
export type ReadingLineHeight = (typeof READING_LINE_HEIGHT_OPTIONS)[number];
export type ReadingWidth = (typeof READING_WIDTH_OPTIONS)[number];
export type ReadingEmphasis = (typeof READING_EMPHASIS_OPTIONS)[number];
export type ReadingColorPreset = (typeof READING_COLOR_PRESET_OPTIONS)[number];
export type PlaybackRate = (typeof PLAYBACK_RATE_OPTIONS)[number];
export type PlaybackLoopCount = (typeof PLAYBACK_LOOP_COUNT_OPTIONS)[number];
export type ResumeBehavior = (typeof RESUME_BEHAVIOR_OPTIONS)[number];
export type StudyAtmosphere = (typeof STUDY_ATMOSPHERE_OPTIONS)[number];
export type SentenceMarkKind = (typeof SENTENCE_MARK_KINDS)[number];
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
  pronunciationSort: PronunciationSort;
  pronunciationDuration: PronunciationDuration;
  pronunciationHideCompleted: boolean;
  readingFurigana: ReadingFurigana;
  readingTranslation: ReadingTranslation;
  readingJpFont: ReadingJpFont;
  readingTextSize: ReadingTextSize;
  readingLineHeight: ReadingLineHeight;
  readingWidth: ReadingWidth;
  readingEmphasis: ReadingEmphasis;
  readingColorPreset: ReadingColorPreset;
  playbackDefaultRate: PlaybackRate;
  playbackLoopCount: PlaybackLoopCount;
  playbackAutoPause: boolean;
  showShortcutHints: boolean;
  resumeBehavior: ResumeBehavior;
  studyAtmosphere: StudyAtmosphere;
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
  pronunciationSort: "recommended",
  pronunciationDuration: null,
  pronunciationHideCompleted: false,
  readingFurigana: "adaptive",
  readingTranslation: "always",
  readingJpFont: "gothic",
  readingTextSize: "m",
  readingLineHeight: "comfortable",
  readingWidth: "normal",
  readingEmphasis: "soft",
  readingColorPreset: "warm_cream",
  playbackDefaultRate: 1,
  playbackLoopCount: 1,
  playbackAutoPause: false,
  showShortcutHints: false,
  resumeBehavior: "resume",
  studyAtmosphere: "none",
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
