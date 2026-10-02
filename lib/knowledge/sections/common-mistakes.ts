import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

const item = z.object({ mistake: z.string(), correction: z.string(), why: z.string() });
export const commonMistakesSchema = z.object({ items: z.array(item) });
export const commonMistakesPreviewSchema = z.object({ items: z.array(item) });

export const commonMistakesSection = defineSection({
  section: "common_mistakes",
  schema: commonMistakesSchema,
  previewSchema: commonMistakesPreviewSchema,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "none",
  access: "free_preview",
  maxOutputTokens: { full: 900, preview: 250 },
  buildPrompt: (input, variant) => ({
    system: sectionSystem(input.locale, [
      `List ${variant === "preview" ? "exactly one" : "two to four"} mistakes learners typically make when producing a sentence like this one.`,
      "mistake: the wrong Japanese a learner would say. correction: the right Japanese. why: one or two sentences.",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence }),
  }),
  projectPreview: (full) => ({ items: full.items.slice(0, 1) }),
});
