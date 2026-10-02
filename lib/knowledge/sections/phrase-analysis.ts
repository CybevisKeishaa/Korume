import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

export const phraseAnalysisSchema = z.object({
  phrase: z.string(),
  breakdown: z.array(z.object({ part: z.string(), role: z.string(), meaning: z.string() })),
  nuance: z.string(),
});

/** A learner's selection, read inside its sentence; keyed by the parent sentence, charged against it (spec §5.3). */
export const phraseAnalysisSection = defineSection({
  section: "phrase_analysis",
  schema: phraseAnalysisSchema,
  previewSchema: null,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "parent_sentence",
  access: "free_full",
  maxOutputTokens: { full: 700, preview: null },
  buildPrompt: (input) => ({
    system: sectionSystem(input.locale, [
      "Explain the selected phrase as it is used inside the sentence.",
      "phrase: the phrase as selected. breakdown: its parts in order — part (the characters), role (word class or grammatical function), meaning.",
      "nuance: what the phrase adds to this sentence, in two sentences at most.",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence, phrase: input.phrase }),
  }),
  projectPreview: () => null,
});
