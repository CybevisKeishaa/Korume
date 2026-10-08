import { z } from "zod";
import { JLPT_LEVELS, type JlptLevel } from "@/lib/conversation-types";
import { canonicalTimeZone } from "@/lib/time/study-day";
import { NATIVE_LANGUAGES } from "./languages";
import { PREFERRED_PRACTICES } from "./practices";
import { isCountryCode } from "./countries";
import { validateUsername } from "./username";

export const BIO_MAX = 160;
export const LEARNING_GOAL_MAX = 200;
export const DISPLAY_NAME_MAX = 50;

const codePoints = (value: string) => [...value].length;
const boundedText = (max: number) =>
  z.string().transform((value) => value.trim()).refine((value) => codePoints(value) <= max, { message: "too_long" });

/** The `users` columns Edit Profile owns (spec §2.1). Shared by the client form and `PATCH /api/profile`. */
export const profileFieldsSchema = z.object({
  displayName: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(DISPLAY_NAME_MAX)),
  username: z.string().nullable().transform((raw, ctx) => {
    if (raw === null || raw.trim() === "") return null;
    const result = validateUsername(raw);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.reason });
      return z.NEVER;
    }
    return result.value;
  }),
  bio: boundedText(BIO_MAX),
  country: z.string().nullable().refine((value) => value === null || isCountryCode(value), { message: "country" }),
  timeZone: z.string().transform((raw, ctx) => {
    const canonical = canonicalTimeZone(raw);
    if (canonical === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "time_zone" });
      return z.NEVER;
    }
    return canonical;
  }),
  nativeLanguage: z.enum(NATIVE_LANGUAGES).nullable(),
  // JLPT_LEVELS is `readonly JlptLevel[]`, not a tuple, so it cannot feed z.enum.
  targetJlptLevel: z.string().nullable()
    .refine((value) => value === null || (JLPT_LEVELS as readonly string[]).includes(value), { message: "jlpt_level" })
    .transform((value) => value as JlptLevel | null),
  learningGoal: boundedText(LEARNING_GOAL_MAX),
  preferredPractices: z.array(z.enum(PREFERRED_PRACTICES)).max(PREFERRED_PRACTICES.length)
    .refine((values) => new Set(values).size === values.length, { message: "duplicate" }),
}).strict();

export type ProfileFields = z.output<typeof profileFieldsSchema>;
