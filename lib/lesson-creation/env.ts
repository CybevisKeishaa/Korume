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
