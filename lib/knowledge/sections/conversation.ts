import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

const turn = z.object({
  /** 0 or 1: an index into roles. */
  role: z.number(),
  jp: z.string(),
  reading: z.string(),
  translation: z.string(),
});
export const conversationSchema = z.object({ context: z.string(), roles: z.array(z.string()), turns: z.array(turn) });
export const conversationPreviewSchema = z.object({ context: z.string(), roles: z.array(z.string()), turns: z.array(turn) });

/** A generated sample dialogue (spec R10). It never opens or changes Conversation Partner. */
export const conversationSection = defineSection({
  section: "conversation",
  schema: conversationSchema,
  previewSchema: conversationPreviewSchema,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "none",
  access: "free_preview",
  maxOutputTokens: { full: 1200, preview: 350 },
  buildPrompt: (input, variant) => ({
    system: sectionSystem(input.locale, [
      `Write a short original dialogue of ${variant === "preview" ? "exactly two" : "four to six"} turns between two people in which this sentence, or a close variation, is said naturally.`,
      "context: the situation in one sentence. roles: exactly two short role names.",
      "turns: in order; role is 0 or 1 (an index into roles); jp: the line; reading: the whole line in hiragana; translation: a natural translation.",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence }),
  }),
  projectPreview: (full) => ({ context: full.context, roles: [...full.roles], turns: full.turns.slice(0, 2) }),
});
