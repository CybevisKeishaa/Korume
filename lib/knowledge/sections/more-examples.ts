import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

const example = z.object({ jp: z.string(), reading: z.string(), translation: z.string() });
export const moreExamplesSchema = z.object({ examples: z.array(example) });
export const moreExamplesPreviewSchema = z.object({ examples: z.array(example) });

export const moreExamplesSection = defineSection({
  section: "more_examples",
  schema: moreExamplesSchema,
  previewSchema: moreExamplesPreviewSchema,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "none",
  access: "free_preview",
  maxOutputTokens: { full: 1000, preview: 300 },
  buildPrompt: (input, variant) => ({
    system: sectionSystem(input.locale, [
      `Write ${variant === "preview" ? "exactly one" : "three to five"} original example sentences that reuse the main grammar or expression of the sentence in a new situation.`,
      "Write your own sentences; never copy from a dictionary or a known source.",
      "jp: the sentence. reading: the whole sentence in hiragana. translation: a natural translation.",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence }),
  }),
  projectPreview: (full) => ({ examples: full.examples.slice(0, 1) }),
});
