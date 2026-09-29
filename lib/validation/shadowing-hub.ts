import { z } from "zod";
import { DEFAULT_PREFERENCES, PRONUNCIATION_DURATION_OPTIONS, PRONUNCIATION_SORT_OPTIONS } from "@/lib/preferences/options";

// An invalid display value falls back to its default instead of failing the page.
const sort = z.enum(PRONUNCIATION_SORT_OPTIONS).catch(DEFAULT_PREFERENCES.pronunciationSort);
// `any` spells "no band" in a URL that must override a saved band.
const duration = z.preprocess((value) => value === "any" ? null : value, z.enum(PRONUNCIATION_DURATION_OPTIONS).nullable().catch(null).optional()).transform((value) => value ?? null);
const hideCompleted = z.preprocess((value) => value === "true" ? true : value === "false" ? false : undefined, z.boolean().catch(DEFAULT_PREFERENCES.pronunciationHideCompleted));

/** The studio's display params alone: each falls back by itself, so a bad `q` cannot discard them. */
export const pronunciationDisplaySchema = z.object({ sort, duration, hideCompleted });

/** Server-rendered Hub discovery controls accept only one bounded term and a known taxonomy axis. */
export const shadowingHubQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  filter: z.string().regex(/^(situation|source):[a-z0-9-]+$/).optional(),
});

export type ShadowingHubQuery = z.infer<typeof shadowingHubQuerySchema>;
