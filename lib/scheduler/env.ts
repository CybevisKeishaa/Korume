/**
 * `SCHEDULER_ENABLED` — the one switch that decides whether anybody's account
 * deletion ever executes.
 *
 * Whole-branch review, I2. `lib/scheduler/start.ts` read this variable RAW
 * (`process.env.SCHEDULER_ENABLED !== "true"`) and it was registered with
 * nothing, so every near-miss meant "silently never execute anybody's
 * deletion" while the app kept accepting requests and kept telling users
 * their data was scheduled for deletion on a date:
 *
 *   SCHEDULER_ENABLED=1      -> off, silently
 *   SCHEDULER_ENABLED=TRUE   -> off, silently
 *   SCHEDULER_ENABLED=yes    -> off, silently
 *   SCHEDULER_ENABLE=true    -> off, silently (typo)
 *
 * The deploy target is a hand-configured single Node instance (almostgone.vn),
 * so this is a plausible production outcome rather than a hypothetical, and
 * the failure is invisible for seven days by construction.
 *
 * The lifecycle here matches `lib/ai/env.ts` and `lib/speech-scoring/env.ts`
 * (Spec D9), with one deliberate difference: **unset is legal and means
 * off.** Unlike a provider selection, "no scheduler" is the correct default
 * for a `next build`, a test run, and every developer machine — it must not
 * take a deliberate opt-OUT to avoid deleting accounts. What is NOT legal is
 * a value that is neither `"true"` nor `"false"`: that is a misconfiguration
 * someone typed intending something, and it fails startup rather than being
 * read as "off".
 */
import { z } from "zod";
import type { EnvSpec } from "@/lib/env/validate";

export const schedulerEnvSchema = z.object({
  SCHEDULER_ENABLED: z
    .enum(["true", "false"], {
      errorMap: () => ({
        message:
          'SCHEDULER_ENABLED must be exactly "true" or "false" (or unset, which ' +
          'means false). Values like "1", "TRUE" or "yes" are NOT accepted: they ' +
          "would silently disable the scheduler, and a disabled scheduler never " +
          "executes any account deletion while the app keeps promising users a " +
          "date. See .env.local.example.",
      }),
    })
    .optional(),
});

export type SchedulerEnvShape = z.infer<typeof schedulerEnvSchema>;

/** Registered at startup by `instrumentation.ts`, alongside the AI and speech specs. */
export const schedulerEnvSpec: EnvSpec<SchedulerEnvShape> = {
  name: "scheduler",
  schema: schedulerEnvSchema,
};
