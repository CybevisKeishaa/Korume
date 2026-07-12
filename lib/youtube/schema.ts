import { z } from "zod";
import { parseVideoId } from "./video-id";

/** POST /api/videos/import body. */
export const importVideoSchema = z.object({
  youtubeUrl: z
    .string()
    .trim()
    .min(1, "A YouTube URL is required.")
    .refine((value) => parseVideoId(value) !== null, {
      message: "Could not recognize a YouTube video URL or ID.",
    }),
});
export type ImportVideoInput = z.infer<typeof importVideoSchema>;
