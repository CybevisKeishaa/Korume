import { z } from "zod";

/** Spec W §2: transient worksheet settings; nothing persists. */
export interface WorksheetSettings {
  mode: "practice" | "selfTest";
  density: "airy" | "compact";
  includeKanaOnly: boolean;
  showReading: boolean;
  showMeaning: boolean;
  showExample: boolean;
}

export const DEFAULT_WORKSHEET_SETTINGS: WorksheetSettings = {
  mode: "practice", density: "airy", includeKanaOnly: false, showReading: true, showMeaning: true, showExample: true,
};

/** In self-test these are prompts, and the last enabled one cannot be turned off. */
export const PROMPT_KEYS = ["showReading", "showMeaning", "showExample"] as const;

export const worksheetSettingsSchema = z.object({
  mode: z.enum(["practice", "selfTest"]),
  density: z.enum(["airy", "compact"]),
  includeKanaOnly: z.boolean(),
  showReading: z.boolean(),
  showMeaning: z.boolean(),
  showExample: z.boolean(),
}).strict();
