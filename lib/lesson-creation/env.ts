import { z } from "zod";
import type { EnvSpec } from "@/lib/env/validate";

export const lessonCreationWorkerEnvSchema = z.object({
  LESSON_CREATION_WORKER_ENABLED: z
    .enum(["true", "false"], {
      errorMap: () => ({
        message:
          'LESSON_CREATION_WORKER_ENABLED must be exactly "true" or "false" ' +
          '(or unset, which means false). Values like "1", "TRUE" or "yes" ' +
          "are NOT accepted: they would silently disable lesson creation work.",
      }),
    })
    .optional(),
});

export type LessonCreationWorkerEnvShape = z.infer<typeof lessonCreationWorkerEnvSchema>;

export const lessonCreationWorkerEnvSpec: EnvSpec<LessonCreationWorkerEnvShape> = {
  name: "lesson-creation-worker",
  schema: lessonCreationWorkerEnvSchema,
};

/**
 * The single home of the "is the worker running?" rule, shared by the process
 * that starts it and the endpoints that refuse to record work for it. Only the
 * exact literal enables it: an unset, misspelled, or near-miss value means a
 * queued job would sit untouched forever, so an enqueue must fail loudly
 * instead. Read at call time — the startup spec above validates the value; this
 * only interprets it.
 */
export function isLessonCreationWorkerEnabled(): boolean {
  return process.env.LESSON_CREATION_WORKER_ENABLED === "true";
}
