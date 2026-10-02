import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

export const quizSchema = z.object({
  questions: z.array(z.object({
    prompt: z.string(),
    choices: z.array(z.string()),
    /** 0-based index into choices. Not range-checked by the schema (a constraint would reject paid output): the UI validates. */
    answerIndex: z.number(),
    explanation: z.string(),
  })),
});
/** No answers and no explanations, at any depth (spec §5.4). */
export const quizPreviewSchema = z.object({
  questions: z.array(z.object({ prompt: z.string(), choices: z.array(z.string()) })),
});

export const quizSection = defineSection({
  section: "quiz",
  schema: quizSchema,
  previewSchema: quizPreviewSchema,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "none",
  access: "free_preview",
  maxOutputTokens: { full: 1100, preview: 200 },
  buildPrompt: (input, variant) => ({
    system: sectionSystem(input.locale, variant === "preview"
      ? [
        "Write exactly one multiple-choice question that checks understanding of the grammar or vocabulary of this sentence.",
        "prompt: the question. choices: three or four options. Do not reveal or mark the answer.",
      ].join("\n")
      : [
        "Write three to five multiple-choice questions that check understanding of the grammar and vocabulary of this sentence.",
        "prompt: the question. choices: three or four options, exactly one correct.",
        "answerIndex: the 0-based position of the correct choice. explanation: why it is correct, in one or two sentences.",
      ].join("\n")),
    user: dataBlocks({ sentence: input.sentence }),
  }),
  // Rebuilt field by field: a spread could carry answerIndex or explanation into the preview.
  projectPreview: (full) => ({
    questions: full.questions.slice(0, 1).map((question) => ({ prompt: question.prompt, choices: [...question.choices] })),
  }),
});
