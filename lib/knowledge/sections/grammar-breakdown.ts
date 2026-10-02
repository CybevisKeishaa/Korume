import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

export const grammarBreakdownSchema = z.object({
  items: z.array(z.object({
    /** The pattern's text exactly as it appears in the sentence; the UI finds it by string search. */
    surface: z.string(),
    pattern: z.string(),
    meaning: z.string(),
    explanation: z.string(),
  })),
});

export const grammarBreakdownSection = defineSection({
  section: "grammar_breakdown",
  schema: grammarBreakdownSchema,
  previewSchema: null,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "none",
  access: "free_full",
  maxOutputTokens: { full: 1200, preview: null },
  buildPrompt: (input) => ({
    system: sectionSystem(input.locale, [
      "Break the sentence into its grammar patterns, in sentence order, at most six.",
      "surface: the exact characters of the pattern as written in the sentence (copy them, do not normalise).",
      "pattern: the dictionary form of the pattern, e.g. 〜ている, 〜のに.",
      "meaning: a short gloss. explanation: how it works here, in two sentences at most.",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence }),
  }),
  projectPreview: () => null,
});
