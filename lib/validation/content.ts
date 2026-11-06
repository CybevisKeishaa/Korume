import { z } from "zod";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";

export const jlptLevelSchema = z.enum(["N5", "N4", "N3", "N2", "N1"]);
export type JlptLevel = z.infer<typeof jlptLevelSchema>;

/** ?level=N5 — optional; absent means "all levels". */
export const levelQuerySchema = z.object({
  level: jlptLevelSchema.optional(),
});

export const itemTypeSchema = z.enum(["kanji", "vocab"]);
export type ItemType = z.infer<typeof itemTypeSchema>;

const quality = z.number().int().min(0).max(5);

/** POST /api/srs/review body. Vocab is keyed by uuid, kanji by its literal (one Han code point); quality is SM-2 0–5. */
export const srsReviewSchema = z.discriminatedUnion("itemType", [
  z.object({ itemType: z.literal("vocab"), itemId: z.string().uuid(), quality }),
  z.object({ itemType: z.literal("kanji"), itemId: z.string().refine((v) => parseKanjiLiteral(v) === v), quality }),
]);
export type SrsReviewInput = z.infer<typeof srsReviewSchema>;
