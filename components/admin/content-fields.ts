import type { ContentType } from "@/lib/admin-ui-types";
import type { useTranslations } from "@/lib/i18n";

/** Shared by every helper below that needs to resolve an `admin.*` catalog
 * key — the same shape whether the caller got `t` from `useTranslations`
 * (client, or a synchronous server component) per the project's translator
 * idiom (a hook can't be called at module scope, so `t` is always passed in,
 * mirroring `scenario-picker.tsx`'s `scenarioLabel` / `forum-post-item.tsx`'s
 * `topicLabel`). */
type Translator = ReturnType<typeof useTranslations<"admin">>;

/**
 * `field.name` is `string` (33 distinct real values spread across 5 content
 * types — a full literal-union rewrite of `ContentFieldConfig.name` would
 * buy little), so `t(\`content.fields.${type}.${name}.label\`)` can't
 * type-check against next-intl's generated literal key union the way a
 * narrow-union key (e.g. `ContentType` alone) can. Every concrete
 * `${type}.${name}` combination this file ever builds is enumerated in
 * `CONTENT_FIELDS` below and pinned key-for-key in `admin.pin.test.ts`, and
 * `catalog.test.ts` proves en/vi key-set parity — so the escape hatch here
 * (`as never`, assignable to any parameter type) is a deliberate, checked
 * one, not a silent `any`. */
function messageKey(t: Translator, key: string): string {
  return t(key as never);
}

/** JLPT level options, strictest-to-loosest N5..N1 (matches `jlptLevelSchema`
 * in `lib/validation/content.ts`, hand-copied rather than imported since it's
 * a `z.enum` and this file wants a plain readonly string array for a native
 * `<select>`). Left untranslated (D8): these are the exam's own level codes,
 * not natural-language chrome — identical in every locale, same as the
 * style guide's JLPT N5/N4/N3 demo options. */
export const JLPT_LEVEL_OPTIONS = ["N5", "N4", "N3", "N2", "N1"] as const;

export type ContentFieldKind = "text" | "textarea" | "number" | "select" | "json";

export interface ContentFieldConfig {
  name: string;
  kind: ContentFieldKind;
  /** For `kind: "select"`. */
  options?: readonly string[];
  /** Required on create (rendered with `required` and validated before submit). */
  required?: boolean;
  /** May be cleared to `null` (empty input maps to `null` rather than being omitted). */
  nullable?: boolean;
  /** Shown as fine print under the field — used for JSON shape hints.
   * Deliberately plain (not a catalog key, D8): this documents a literal
   * JSON shape (field names, types) the same way a code sample would, so it
   * is shown identically regardless of locale rather than partially
   * translated around untranslatable JSON keys. */
  helpText?: string;
}

/** English-only, used solely by `app/[locale]/(admin)/admin/content/[type]/
 * page.tsx`'s `generateMetadata` (the `<title>` tag) — page metadata is a
 * static export that cannot call a translator; converting it to
 * `generateMetadata({params: {locale}})` + `getTranslations` is Task 18's
 * job (spec §7 plan), out of scope here. UI chrome must NOT read this map —
 * use `contentTypeLabel(t, type)` below instead. */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  kanji: "Kanji",
  vocab: "Vocabulary",
  grammar: "Grammar",
  jlpt_tests: "JLPT Tests",
  reading_passages: "Reading Passages",
};

/** Translated content-type label for UI chrome (card headers, dialog
 * titles, buttons, empty states) — every consumer except the metadata title
 * above. */
export function contentTypeLabel(t: Translator, type: ContentType): string {
  return t(`content.types.${type}.label`);
}

/** Translated one-line description shown on `/admin/content`'s type cards. */
export function contentTypeDescription(t: Translator, type: ContentType): string {
  return t(`content.types.${type}.description`);
}

/** Translated placeholder/label for a type's list-search input. */
export function contentSearchLabel(t: Translator, type: ContentType): string {
  return t(`content.types.${type}.searchLabel`);
}

/** Translated label for one field of one content type — the source
 * `content-form.tsx` renders next to each input. `name` is plain `string`
 * (33 distinct field names across 5 types), so this goes through
 * `messageKey`'s checked escape hatch — see its doc comment. */
export function fieldLabel(t: Translator, type: ContentType, name: string): string {
  return messageKey(t, `content.fields.${type}.${name}.label`);
}

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
    { name: "character", kind: "text", required: true },
    { name: "jlpt_level", kind: "select", options: JLPT_LEVEL_OPTIONS, nullable: true },
    { name: "stroke_count", kind: "number", nullable: true },
    { name: "radical_id", kind: "text", nullable: true },
    { name: "meaning_en", kind: "textarea", nullable: true },
    { name: "meaning_vi", kind: "textarea", nullable: true },
    { name: "mnemonic_text", kind: "textarea", nullable: true },
    { name: "mnemonic_image_url", kind: "text", nullable: true },
    { name: "stroke_order_svg", kind: "textarea", nullable: true },
    {
      name: "readings",
      kind: "json",
      helpText: 'Array of {"reading": string, "reading_type": "on" | "kun"}. Leave blank to leave existing readings unchanged.',
    },
  ],
  vocab: [
    { name: "word", kind: "text", required: true },
    { name: "reading", kind: "text", nullable: true },
    { name: "meaning_en", kind: "textarea", nullable: true },
    { name: "meaning_vi", kind: "textarea", nullable: true },
    { name: "jlpt_level", kind: "select", options: JLPT_LEVEL_OPTIONS, nullable: true },
    { name: "audio_url", kind: "text", nullable: true },
    { name: "part_of_speech", kind: "text", nullable: true },
  ],
  grammar: [
    { name: "title", kind: "text", required: true },
    { name: "jlpt_level", kind: "select", options: JLPT_LEVEL_OPTIONS, nullable: true },
    { name: "explanation", kind: "textarea", nullable: true },
    { name: "structure_pattern", kind: "text", nullable: true },
    {
      name: "example_sentences",
      kind: "json",
      helpText: 'Array of {"jp": string, "en": string}. Leave blank to leave existing examples unchanged.',
    },
  ],
  jlpt_tests: [
    { name: "level", kind: "select", options: JLPT_LEVEL_OPTIONS, required: true },
    { name: "title", kind: "text", required: true },
    {
      name: "section_config",
      kind: "json",
      helpText: "Freeform object, shape varies by level. Leave blank to leave unchanged.",
    },
    {
      name: "questions",
      kind: "json",
      helpText:
        'Array of {"section": "vocab"|"grammar"|"reading"|"listening", "question_type": string, "question_data": {"stem": string, "passage"?: string, "audio_text"?: string, "choices": [4 strings]}, "correct_answer": "0"|"1"|"2"|"3", "explanation"?: string, "order_index"?: number}. Leave blank to leave existing questions unchanged.',
    },
  ],
  reading_passages: [
    { name: "title", kind: "text", required: true },
    { name: "jlpt_level", kind: "select", options: JLPT_LEVEL_OPTIONS, required: true },
    { name: "body_jp", kind: "textarea", required: true },
    { name: "body_translation", kind: "textarea", nullable: true },
    { name: "word_count", kind: "number", nullable: true },
    {
      name: "questions",
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

/** The one column, per type, used to identify a row in headings/aria-labels
 * (e.g. "Edit 犬", "Delete 猫"). Matches each type's `searchColumn`. Not
 * translated — it's a DB column name, structural data, not chrome. */
export const CONTENT_PRIMARY_FIELD: Record<ContentType, string> = {
  kanji: "character",
  vocab: "word",
  grammar: "title",
  jlpt_tests: "title",
  reading_passages: "title",
};

/** Human label for a list-table column; falls back to the field's own
 * translated label, then a couple of hand-named non-field columns, then the
 * raw column name (unreachable today — every `CONTENT_LIST_COLUMNS` entry
 * besides `created_at` has a matching `CONTENT_FIELDS` config — kept as a
 * defensive fallback, same as the pre-extraction source). */
export function columnLabel(t: Translator, type: ContentType, column: string): string {
  if (column === "created_at") return t("content.columns.created");
  const field = CONTENT_FIELDS[type].find((f) => f.name === column);
  return field ? fieldLabel(t, type, field.name) : column;
}
