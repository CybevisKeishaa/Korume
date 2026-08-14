import { z } from "zod";
import { jlptLevelSchema } from "@/lib/validation/content";
import { jlptSectionSchema } from "@/lib/validation/jlpt";

/** The five admin CMS content types (spec §3.11 "CMS quản lý kanji, vocab,
 * grammar, đề JLPT"; reading added per Layer 5). Route path segment
 * `/api/admin/content/[type]` is whitelisted against this exact set. */
export const contentTypeSchema = z.enum(["kanji", "vocab", "grammar", "jlpt_tests", "reading_passages"]);
export type ContentType = z.infer<typeof contentTypeSchema>;
export const CONTENT_TYPES: readonly ContentType[] = contentTypeSchema.options;

/** GET /api/admin/content/[type]?page=&pageSize=&search= */
export const contentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
});
export type ContentListQuery = z.infer<typeof contentListQuerySchema>;

// ---------------------------------------------------------------------------
// Kanji (table `kanji` + child `kanji_readings`)
// ---------------------------------------------------------------------------
const kanjiReadingSchema = z.object({
  reading: z.string().min(1).max(20),
  reading_type: z.enum(["on", "kun"]),
});

export const createKanjiSchema = z.object({
  character: z.string().min(1).max(8),
  jlpt_level: jlptLevelSchema.nullable().optional(),
  stroke_count: z.number().int().positive().nullable().optional(),
  radical_id: z.string().uuid().nullable().optional(),
  meaning_en: z.string().max(500).nullable().optional(),
  meaning_vi: z.string().max(500).nullable().optional(),
  stroke_order_svg: z.string().max(50_000).nullable().optional(),
  mnemonic_text: z.string().max(2000).nullable().optional(),
  mnemonic_image_url: z.string().url().nullable().optional(),
  /** Full replace on write — omit entirely to leave existing readings
   * untouched on update; an empty array clears them. */
  readings: z.array(kanjiReadingSchema).max(50).optional(),
});
export type CreateKanjiInput = z.infer<typeof createKanjiSchema>;
export const updateKanjiSchema = createKanjiSchema.partial();
export type UpdateKanjiInput = z.infer<typeof updateKanjiSchema>;

/** CSV rows are flat cells — no `readings` column (nested rows aren't
 * expressible in one flat CSV row; add readings via the detail edit UI after
 * import). */
export const kanjiCsvRowSchema = createKanjiSchema.omit({ readings: true });

// ---------------------------------------------------------------------------
// Vocab (table `vocab`, no child table in CRUD scope)
// ---------------------------------------------------------------------------
export const createVocabSchema = z.object({
  word: z.string().min(1).max(100),
  reading: z.string().max(100).nullable().optional(),
  meaning_en: z.string().max(500).nullable().optional(),
  meaning_vi: z.string().max(500).nullable().optional(),
  jlpt_level: jlptLevelSchema.nullable().optional(),
  audio_url: z.string().url().nullable().optional(),
  part_of_speech: z.string().max(50).nullable().optional(),
});
export type CreateVocabInput = z.infer<typeof createVocabSchema>;
export const updateVocabSchema = createVocabSchema.partial();
export type UpdateVocabInput = z.infer<typeof updateVocabSchema>;
export const vocabCsvRowSchema = createVocabSchema;

// ---------------------------------------------------------------------------
// Grammar (table `grammar_points`, no child table in CRUD scope)
// ---------------------------------------------------------------------------
const exampleSentenceSchema = z.object({
  jp: z.string().min(1).max(500),
  en: z.string().min(1).max(500),
});

export const createGrammarSchema = z.object({
  title: z.string().min(1).max(200),
  jlpt_level: jlptLevelSchema.nullable().optional(),
  explanation: z.string().max(5000).nullable().optional(),
  structure_pattern: z.string().max(500).nullable().optional(),
  example_sentences: z.array(exampleSentenceSchema).max(20).optional(),
});
export type CreateGrammarInput = z.infer<typeof createGrammarSchema>;
export const updateGrammarSchema = createGrammarSchema.partial();
export type UpdateGrammarInput = z.infer<typeof updateGrammarSchema>;

/** CSV rows exclude `example_sentences` (a jsonb array — not flat-CSV
 * shaped); imported rows get the column's DB default (`[]`). */
export const grammarCsvRowSchema = createGrammarSchema.omit({ example_sentences: true });

// ---------------------------------------------------------------------------
// JLPT tests (table `certification_tests` + child `certification_questions`)
// ---------------------------------------------------------------------------
/** Mirrors `PublicQuestionData` (lib/data/jlpt.ts) — the shape the test-taking
 * UI reads back out of `question_data`. */
const jlptQuestionDataSchema = z.object({
  stem: z.string().min(1).max(2000),
  passage: z.string().max(10_000).optional(),
  audio_text: z.string().max(5000).optional(),
  choices: z.array(z.string().min(1).max(500)).length(4),
});

/** Chosen-choice index "0".."3" — same convention as `jlptSubmitSchema`'s
 * `answerValueSchema` (lib/validation/jlpt.ts), which fixes choices at 4. */
const answerIndexSchema = z.enum(["0", "1", "2", "3"]);

const jlptQuestionSchema = z.object({
  section: jlptSectionSchema,
  question_type: z.string().min(1).max(50),
  question_data: jlptQuestionDataSchema,
  correct_answer: answerIndexSchema,
  explanation: z.string().max(2000).nullable().optional(),
  order_index: z.number().int().min(0).optional(),
});

export const createJlptTestSchema = z.object({
  level: jlptLevelSchema,
  title: z.string().min(1).max(200),
  /** Jsonb passthrough — shape varies by level (N5/N4 combine sections,
   * N3-N1 keep them separate; see lib/jlpt/score.ts PILLAR_STRUCTURE). */
  section_config: z.record(z.string(), z.unknown()).optional(),
  /** Full replace on write — omit to leave existing questions untouched on
   * update; an empty array clears them. */
  questions: z.array(jlptQuestionSchema).max(200).optional(),
});
export type CreateJlptTestInput = z.infer<typeof createJlptTestSchema>;
export const updateJlptTestSchema = createJlptTestSchema.partial();
export type UpdateJlptTestInput = z.infer<typeof updateJlptTestSchema>;

/** CSV rows exclude `questions` (nested rows) and accept `section_config` as
 * a JSON-encoded cell, parsed here; omit the column for the DB default (`{}`). */
const jsonCellSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "section_config must be valid JSON" });
      return z.NEVER;
    }
  });

export const jlptTestCsvRowSchema = z.object({
  level: jlptLevelSchema,
  title: z.string().min(1).max(200),
  section_config: jsonCellSchema,
});

// ---------------------------------------------------------------------------
// Reading passages (table `reading_passages` + child `reading_questions`)
// ---------------------------------------------------------------------------
const readingQuestionSchema = z.object({
  question: z.string().min(1).max(1000),
  options: z.array(z.string().min(1).max(500)).min(2).max(6),
  correct_answer: answerIndexSchema,
  explanation: z.string().max(2000).nullable().optional(),
  order_index: z.number().int().min(0).optional(),
});

export const createReadingPassageSchema = z.object({
  title: z.string().min(1).max(200),
  jlpt_level: jlptLevelSchema,
  body_jp: z.string().min(1).max(20_000),
  body_translation: z.string().max(20_000).nullable().optional(),
  word_count: z.number().int().min(0).nullable().optional(),
  /** Full replace on write — omit to leave existing questions untouched on
   * update; an empty array clears them. */
  questions: z.array(readingQuestionSchema).max(50).optional(),
});
export type CreateReadingPassageInput = z.infer<typeof createReadingPassageSchema>;
export const updateReadingPassageSchema = createReadingPassageSchema.partial();
export type UpdateReadingPassageInput = z.infer<typeof updateReadingPassageSchema>;

/** CSV rows exclude `questions` (nested rows). */
export const readingPassageCsvRowSchema = createReadingPassageSchema.omit({ questions: true });

// ---------------------------------------------------------------------------
// POST /api/admin/content/[type]/import — raw CSV text body.
// ---------------------------------------------------------------------------
export const csvImportBodySchema = z
  .string()
  .min(1, "CSV body is required.")
  .max(1_000_000, "CSV body is too large (max ~1MB).");
