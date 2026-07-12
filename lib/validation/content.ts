import { z } from "zod";

export const jlptLevelSchema = z.enum(["N5", "N4", "N3", "N2", "N1"]);
export type JlptLevel = z.infer<typeof jlptLevelSchema>;

/** ?level=N5 — optional; absent means "all levels". */
export const levelQuerySchema = z.object({
  level: jlptLevelSchema.optional(),
});

export const itemTypeSchema = z.enum(["kanji", "vocab"]);
export type ItemType = z.infer<typeof itemTypeSchema>;

/** POST /api/srs/review body. quality is the SM-2 grade 0–5. */
export const srsReviewSchema = z.object({
  itemType: itemTypeSchema,
  itemId: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
});
export type SrsReviewInput = z.infer<typeof srsReviewSchema>;
