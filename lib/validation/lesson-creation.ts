import { z } from "zod";

import { parseVideoId } from "@/lib/youtube";

/**
 * Request bodies for the lesson-creation job APIs.
 *
 * The client supplies a video and, for an admin, the access level the lesson
 * should ship at. Everything else about a job — requester, origin, state, step,
 * attempt count, lease — is the server's, so these schemas strip unknown keys
 * rather than carrying them toward the store.
 *
 * URL handling keeps the contract the removed `importVideoSchema` carried: any
 * common YouTube URL form, or a bare eleven-character id. This is now its only
 * home — the synchronous importer it belonged to no longer exists.
 */

const youtubeUrlField = z.string().trim().min(1, "A YouTube URL is required.");

function attachVideoId<T extends { youtubeUrl: string }>(
  value: T,
  ctx: z.RefinementCtx,
): (T & { youtubeVideoId: string }) | never {
  const youtubeVideoId = parseVideoId(value.youtubeUrl);
  if (youtubeVideoId === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["youtubeUrl"],
      message: "Could not recognize a YouTube video URL or ID.",
    });
    return z.NEVER;
  }
  return { ...value, youtubeVideoId };
}

/** POST /api/videos/import body. Origin is always `learner`, access always PRIVATE. */
export const enqueueLessonCreationSchema = z
  .object({ youtubeUrl: youtubeUrlField })
  .transform(attachVideoId);
export type EnqueueLessonCreationBody = z.infer<typeof enqueueLessonCreationSchema>;

/**
 * POST /api/admin/lesson-creation-jobs body. `PRIVATE` is deliberately absent:
 * it is the learner origin's access level, and the table's own check constraint
 * refuses an admin job that carries it.
 */
export const adminEnqueueLessonCreationSchema = z
  .object({
    youtubeUrl: youtubeUrlField,
    libraryAccess: z.enum(["FREE", "PLUS"]),
  })
  .transform(attachVideoId);
export type AdminEnqueueLessonCreationBody = z.infer<typeof adminEnqueueLessonCreationSchema>;

/** Route params. A malformed id must never reach the store as a query value. */
export const lessonCreationJobIdSchema = z.string().uuid();
