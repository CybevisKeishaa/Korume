import { z } from "zod";
import { SENTENCE_MARK_KINDS } from "@/lib/preferences/options";

export const sentenceMarkBodySchema = z.object({
  transcriptLineId: z.string().uuid(),
  kind: z.enum(SENTENCE_MARK_KINDS),
}).strict();
