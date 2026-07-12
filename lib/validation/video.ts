import { z } from "zod";
import type { TranscriptFormat } from "@/lib/transcript";

export { importVideoSchema, type ImportVideoInput } from "@/lib/youtube";

const transcriptFormatSchema = z.enum(["auto", "srt", "vtt", "plain"]) satisfies z.ZodType<TranscriptFormat>;

/** POST /api/videos/[id]/transcript body. */
export const transcriptIngestSchema = z.object({
  raw: z
    .string()
    .min(1, "Transcript text is required.")
    .max(100_000, "Transcript is too long (max 100,000 characters)."),
  format: transcriptFormatSchema.default("auto"),
});
export type TranscriptIngestInput = z.infer<typeof transcriptIngestSchema>;

/** PATCH /api/videos/[id]/progress body. */
export const progressSchema = z.object({
  position: z.number().min(0),
  completed: z.boolean().optional(),
});
export type ProgressInput = z.infer<typeof progressSchema>;

/** PATCH /api/videos/[id] body — client reports duration once from player.getDuration(). */
export const durationSchema = z.object({
  durationSeconds: z.number().int().min(0),
});
export type DurationInput = z.infer<typeof durationSchema>;
