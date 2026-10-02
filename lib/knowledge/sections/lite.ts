import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

export const liteSchema = z.object({
  summary: z.string(),
  literal: z.string(),
  keyPoints: z.array(z.string()),
});

/** The first card of ✨: what the sentence says, literally, and up to four things worth noticing. Free in full. */
export const liteSection = defineSection({
  section: "lite",
  schema: liteSchema,
  previewSchema: null,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "none",
  access: "free_full",
  maxOutputTokens: { full: 600, preview: null },
  buildPrompt: (input) => ({
    system: sectionSystem(input.locale, [
      "Explain the sentence briefly.",
      "summary: its meaning in one or two natural sentences.",
      "literal: a word-for-word gloss that shows the Japanese structure.",
      "keyPoints: one to four short points a learner should notice (a grammar form, a nuance, a set phrase).",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence }),
  }),
  projectPreview: () => null,
});
