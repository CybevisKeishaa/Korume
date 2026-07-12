import { z } from "zod";

/**
 * POST /api/mining body — tap a transcript line + target word to mint an SRS
 * card. The sentence text, translation fallback, and timestamps are derived
 * server-side from the referenced `transcript_lines` row (see
 * `lib/data/mining.ts::createMiningCard`) — never trusted from the client.
 */
export const createMiningCardSchema = z.object({
  lineId: z.string().uuid(),
  targetWord: z.string().min(1, "Target word is required.").max(50, "Target word is too long (max 50 characters)."),
  reading: z.string().max(50, "Reading is too long (max 50 characters).").optional(),
  sentenceTranslation: z
    .string()
    .max(500, "Translation is too long (max 500 characters).")
    .optional(),
});
export type CreateMiningCardInput = z.infer<typeof createMiningCardSchema>;

/**
 * POST /api/mining/review body. `cardId` is the surrogate primary key of a
 * `sentence_mining_cards` row — an id-keyed variant of the composite-keyed
 * `srsReviewSchema` used by `/api/srs/review` (vocab/kanji).
 */
export const reviewMiningCardSchema = z.object({
  cardId: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
});
export type ReviewMiningCardInput = z.infer<typeof reviewMiningCardSchema>;

/** GET /api/mining/queue — optional cap on the number of due cards returned. */
export const miningQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MiningQueueQuery = z.infer<typeof miningQueueQuerySchema>;
