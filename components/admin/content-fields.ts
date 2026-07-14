import type { ContentType } from "@/lib/admin-ui-types";

/** JLPT level options, strictest-to-loosest N5..N1 (matches `jlptLevelSchema`
 * in `lib/validation/content.ts`, hand-copied rather than imported since it's
 * a `z.enum` and this file wants a plain readonly string array for a native
 * `<select>`). */
export const JLPT_LEVEL_OPTIONS = ["N5", "N4", "N3", "N2", "N1"] as const;

export type ContentFieldKind = "text" | "textarea" | "number" | "select" | "json";

export interface ContentFieldConfig {
  name: string;
  label: string;
  kind: ContentFieldKind;
  /** For `kind: "select"`. */
  options?: readonly string[];
  /** Required on create (rendered with `required` and validated before submit). */
  required?: boolean;
  /** May be cleared to `null` (empty input maps to `null` rather than being omitted). */
  nullable?: boolean;
  /** Shown as fine print under the field — used for JSON shape hints. */
  helpText?: string;
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  kanji: "Kanji",
  vocab: "Vocabulary",
  grammar: "Grammar",
  jlpt_tests: "JLPT Tests",
  reading_passages: "Reading Passages",
};

export const CONTENT_TYPE_DESCRIPTIONS: Record<ContentType, string> = {
  kanji: "Characters, readings, meanings, mnemonics and stroke order.",
  vocab: "Words, readings and meanings by JLPT level.",
  grammar: "Grammar points, explanations and example sentences.",
  jlpt_tests: "Full JLPT mock tests with nested questions.",
  reading_passages: "Reading comprehension passages with questions.",
};

/**
 * Per-type field configuration driving the generic create/edit form
 * (`components/admin/content-form.tsx`). Hand-written against the create
 * schemas in `lib/validation/admin-content.ts` — pragmatic MVP choice noted
 * in the Layer 7 handoff rather than deriving a form schema from zod at
 * runtime. Fields with `kind: "json"` are exactly the nested-child columns
 * (`readings`, `example_sentences`, `section_config`, `questions`) — edited
 * as a raw JSON textarea rather than a repeating field group; see that
 * module's doc comments for the exact shape expected in each.
 */
export const CONTENT_FIELDS: Record<ContentType, ContentFieldConfig[]> = {
  kanji: [
    { name: "character", label: "Character", kind: "text", required: true },
    { name: "jlpt_level", label: "JLPT level", kind: "select", options: JLPT_LEVEL_OPTIONS, nullable: true },
    { name: "stroke_count", label: "Stroke count", kind: "number", nullable: true },
    { name: "radical_id", label: "Radical ID (uuid)", kind: "text", nullable: true },
    { name: "meaning_en", label: "Meaning (EN)", kind: "textarea", nullable: true },
    { name: "meaning_vi", label: "Meaning (VI)", kind: "textarea", nullable: true },
    { name: "mnemonic_text", label: "Mnemonic", kind: "textarea", nullable: true },
    { name: "mnemonic_image_url", label: "Mnemonic image URL", kind: "text", nullable: true },
    { name: "stroke_order_svg", label: "Stroke order SVG", kind: "textarea", nullable: true },
    {
      name: "readings",
      label: "Readings (JSON)",
      kind: "json",
      helpText: 'Array of {"reading": string, "reading_type": "on" | "kun"}. Leave blank to leave existing readings unchanged.',
    },
  ],
  vocab: [
    { name: "word", label: "Word", kind: "text", required: true },
    { name: "reading", label: "Reading", kind: "text", nullable: true },
    { name: "meaning_en", label: "Meaning (EN)", kind: "textarea", nullable: true },
    { name: "meaning_vi", label: "Meaning (VI)", kind: "textarea", nullable: true },
    { name: "jlpt_level", label: "JLPT level", kind: "select", options: JLPT_LEVEL_OPTIONS, nullable: true },
    { name: "audio_url", label: "Audio URL", kind: "text", nullable: true },
    { name: "part_of_speech", label: "Part of speech", kind: "text", nullable: true },
  ],
  grammar: [
    { name: "title", label: "Title", kind: "text", required: true },
    { name: "jlpt_level", label: "JLPT level", kind: "select", options: JLPT_LEVEL_OPTIONS, nullable: true },
    { name: "explanation", label: "Explanation", kind: "textarea", nullable: true },
    { name: "structure_pattern", label: "Structure pattern", kind: "text", nullable: true },
    {
      name: "example_sentences",
      label: "Example sentences (JSON)",
      kind: "json",
      helpText: 'Array of {"jp": string, "en": string}. Leave blank to leave existing examples unchanged.',
    },
  ],
  jlpt_tests: [
    { name: "level", label: "JLPT level", kind: "select", options: JLPT_LEVEL_OPTIONS, required: true },
    { name: "title", label: "Title", kind: "text", required: true },
    {
      name: "section_config",
      label: "Section config (JSON object)",
      kind: "json",
      helpText: "Freeform object, shape varies by level. Leave blank to leave unchanged.",
    },
    {
      name: "questions",
      label: "Questions (JSON)",
      kind: "json",
      helpText:
        'Array of {"section": "vocab"|"grammar"|"reading"|"listening", "question_type": string, "question_data": {"stem": string, "passage"?: string, "audio_text"?: string, "choices": [4 strings]}, "correct_answer": "0"|"1"|"2"|"3", "explanation"?: string, "order_index"?: number}. Leave blank to leave existing questions unchanged.',
    },
  ],
  reading_passages: [
    { name: "title", label: "Title", kind: "text", required: true },
    { name: "jlpt_level", label: "JLPT level", kind: "select", options: JLPT_LEVEL_OPTIONS, required: true },
    { name: "body_jp", label: "Body (Japanese)", kind: "textarea", required: true },
    { name: "body_translation", label: "Body (translation)", kind: "textarea", nullable: true },
    { name: "word_count", label: "Word count", kind: "number", nullable: true },
    {
      name: "questions",
      label: "Questions (JSON)",
      kind: "json",
      helpText:
        'Array of {"question": string, "options": [2-6 strings], "correct_answer": "0"|"1"|"2"|"3", "explanation"?: string, "order_index"?: number}. Leave blank to leave existing questions unchanged.',
    },
  ],
};

/** Columns each type's LIST query actually returns (`listColumns` in
 * `lib/data/admin-content.ts`) — i.e. which fields the edit form can safely
 * pre-fill with a real current value. There is no `GET` single-row endpoint
 * in this layer's contract, so any field NOT in this set is invisible to the
 * edit form's initial state; leaving such a field blank on submit omits it
 * from the PATCH body (untouched) rather than risking silently blanking a
 * value the admin never saw. See `content-payload.ts` for where this is
 * enforced, and the Layer 7 handoff for the open item this implies. */
export const CONTENT_LIST_COLUMNS: Record<ContentType, readonly string[]> = {
  kanji: ["id", "character", "jlpt_level", "stroke_count", "meaning_en", "meaning_vi", "created_at"],
  vocab: ["id", "word", "reading", "meaning_en", "meaning_vi", "jlpt_level", "part_of_speech", "created_at"],
  grammar: ["id", "title", "jlpt_level", "structure_pattern", "created_at"],
  jlpt_tests: ["id", "level", "title", "created_at"],
  reading_passages: ["id", "title", "jlpt_level", "word_count", "created_at"],
};

/** Search placeholder text per type (matches `searchColumn` in
 * `lib/data/admin-content.ts`; `null` there means search is disabled, which
 * doesn't apply to any current type). */
export const CONTENT_SEARCH_LABEL: Record<ContentType, string> = {
  kanji: "Search by character",
  vocab: "Search by word",
  grammar: "Search by title",
  jlpt_tests: "Search by title",
  reading_passages: "Search by title",
};

/** The one column, per type, used to identify a row in headings/aria-labels
 * (e.g. "Edit 犬", "Delete 猫"). Matches each type's `searchColumn`. */
export const CONTENT_PRIMARY_FIELD: Record<ContentType, string> = {
  kanji: "character",
  vocab: "word",
  grammar: "title",
  jlpt_tests: "title",
  reading_passages: "title",
};

/** Human label for a list-table column; falls back to the field's own
 * config label, then a couple of hand-named non-field columns, then the raw
 * column name. */
export function columnLabel(type: ContentType, column: string): string {
  if (column === "created_at") return "Created";
  const field = CONTENT_FIELDS[type].find((f) => f.name === column);
  return field?.label ?? column;
}
