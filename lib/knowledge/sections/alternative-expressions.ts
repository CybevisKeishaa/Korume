import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

const item = z.object({ jp: z.string(), reading: z.string(), translation: z.string(), difference: z.string() });
export const alternativeExpressionsSchema = z.object({ items: z.array(item) });
export const alternativeExpressionsPreviewSchema = z.object({ items: z.array(item) });

export const alternativeExpressionsSection = defineSection({
  section: "alternative_expressions",
  schema: alternativeExpressionsSchema,
  previewSchema: alternativeExpressionsPreviewSchema,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "none",
  access: "free_preview",
  maxOutputTokens: { full: 900, preview: 250 },
  buildPrompt: (input, variant) => ({
    system: sectionSystem(input.locale, [
      `Give ${variant === "preview" ? "exactly one other way" : "two to four other ways"} to say the same thing in Japanese, from casual to formal.`,
      "jp: the sentence. reading: the whole sentence in hiragana. translation: a natural translation.",
      "difference: how it differs from the original in tone or meaning, in one sentence.",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence }),
  }),
  projectPreview: (full) => ({ items: full.items.slice(0, 1) }),
});
