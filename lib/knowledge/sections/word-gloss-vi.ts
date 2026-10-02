import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

export const wordGlossViSchema = z.object({
  glosses: z.array(z.string()),
  /** Empty when there is nothing worth adding. */
  note: z.string(),
});

/** A Vietnamese gloss for one JMdict sense, written once for everyone and funded by the system (spec §4.2). */
export const wordGlossViSection = defineSection({
  section: "word_gloss_vi",
  schema: wordGlossViSchema,
  previewSchema: null,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "dictionary_sense",
  access: "system",
  maxOutputTokens: { full: 200, preview: null },
  buildPrompt: (input) => ({
    system: sectionSystem("vi", [
      "Translate one dictionary sense of a Japanese word into Vietnamese.",
      "glosses: one to three short Vietnamese equivalents for exactly this sense, most common first.",
      "note: one short usage note in Vietnamese if the sense needs it, otherwise an empty string.",
    ].join("\n")),
    user: dataBlocks({
      dictionary: [input.headword, input.reading, ...(input.senseGlossesEn ?? [])].filter(Boolean).join(" | "),
    }),
  }),
  projectPreview: () => null,
});
