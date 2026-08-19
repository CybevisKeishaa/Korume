import "server-only";
import type { ZodTypeAny } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, type RequireAdminResult } from "@/lib/admin/guard";
import { rateLimit } from "@/lib/rate-limit";
import { parseCsv } from "@/lib/csv/parse";
import { sanitizeContentText, sanitizeTranscriptText } from "@/lib/transcript";
import {
  createGrammarSchema,
  createJlptTestSchema,
  createKanjiSchema,
  createReadingPassageSchema,
  createVocabSchema,
  grammarCsvRowSchema,
  jlptTestCsvRowSchema,
  kanjiCsvRowSchema,
  readingPassageCsvRowSchema,
  updateGrammarSchema,
  updateJlptTestSchema,
  updateKanjiSchema,
  updateReadingPassageSchema,
  updateVocabSchema,
  vocabCsvRowSchema,
  type ContentType,
} from "@/lib/validation/admin-content";

export type { ContentType } from "@/lib/validation/admin-content";

/**
 * Generic admin content-CRUD data layer (spec §3.11 "CMS quản lý kanji,
 * vocab, grammar, đề JLPT ... CRUD, import CSV hàng loạt"). One config per
 * content type (table, columns, zod schemas, optional child table) drives
 * uniform list/create/update/delete/CSV-import functions rather than five
 * near-duplicate modules. Every function starts with `requireAdmin()` and
 * writes exclusively through the service-role client — `kanji`/`vocab`/
 * `grammar_points`/`certification_tests`/`certification_questions`/
 * `reading_passages`/`reading_questions` all have RLS policies that only ever
 * grant `authenticated` SELECT (see migrations 1, 2, 11, 13 — all written
 * before the rename, so wherever they mention the two certification tables
 * they use the original names `jlpt_tests`/`jlpt_questions`, renamed by
 * 20260814000027_certification_rename.sql); the matching
 * table-level INSERT/UPDATE/DELETE grants from the one-time
 * `20260712000006_grants.sql` blanket grant were dead weight with no RLS
 * policy to let them through — this module never relies on them, using the
 * service role (bypasses RLS) for every write instead. On the two
 * certification tables and the two reading tables they are now not merely
 * dead but absent, revoked by 20260819000028_certification_grants_hardening
 * and 20260713000011 respectively; on `kanji`/`vocab`/`grammar_points` they
 * are still present and still dead. Either way this module is unaffected.
 */

type GuardFailure = Extract<RequireAdminResult, { ok: false }>;
type Row = Record<string, unknown>;
type ServiceClient = ReturnType<typeof createServiceClient>;

interface ChildConfig {
  /** Child table name, e.g. `kanji_readings`. */
  table: string;
  /** FK column on the child table pointing back at the parent id. */
  parentColumn: string;
  /** Key in the parsed create/update input holding the array of child rows. */
  key: string;
  /** Per-row sanitizer, applied before insert. Returns a new object. */
  sanitize: (row: Row) => Row;
}

interface ContentTypeConfig {
  table: string;
  orderColumn: string;
  listColumns: string;
  detailColumns: string;
  /** Single free-text column `ilike`-searched; `null` disables search for this type. */
  searchColumn: string | null;
  /** Mutates `row` in place, sanitizing whichever free-text fields are present. */
  sanitizeMainRow: (row: Row) => void;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  csvRowSchema: ZodTypeAny;
  child?: ChildConfig;
}

/** Collapse-and-trim sanitize (via `sanitizeTranscriptText`) for short,
 * inherently single-line fields (titles, words, meanings). */
function collapseFields(row: Row, fields: string[]): void {
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "string") row[field] = sanitizeTranscriptText(value);
  }
}

/** Structure-preserving sanitize (via `sanitizeContentText`) for genuinely
 * multi-line/paragraph bodies (mnemonics, explanations, reading passages). */
function preserveFields(row: Row, fields: string[]): void {
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "string") row[field] = sanitizeContentText(value);
  }
}

function sanitizeKanjiReading(row: Row): Row {
  const out = { ...row };
  if (typeof out.reading === "string") out.reading = sanitizeTranscriptText(out.reading);
  return out;
}

function sanitizeGrammarMainRow(row: Row): void {
  collapseFields(row, ["title", "structure_pattern"]);
  preserveFields(row, ["explanation"]);
  if (Array.isArray(row.example_sentences)) {
    row.example_sentences = (row.example_sentences as Row[]).map((entry) => ({
      ...entry,
      jp: typeof entry.jp === "string" ? sanitizeTranscriptText(entry.jp) : entry.jp,
      en: typeof entry.en === "string" ? sanitizeTranscriptText(entry.en) : entry.en,
    }));
  }
}

function sanitizeJlptQuestion(row: Row): Row {
  const out = { ...row };
  if (typeof out.question_type === "string") out.question_type = sanitizeTranscriptText(out.question_type);
  if (typeof out.explanation === "string") out.explanation = sanitizeTranscriptText(out.explanation);

  const questionData = out.question_data;
  if (questionData && typeof questionData === "object") {
    const nextData: Row = { ...(questionData as Row) };
    if (typeof nextData.stem === "string") nextData.stem = sanitizeTranscriptText(nextData.stem);
    if (typeof nextData.passage === "string") nextData.passage = sanitizeContentText(nextData.passage);
    if (typeof nextData.audio_text === "string") nextData.audio_text = sanitizeTranscriptText(nextData.audio_text);
    if (Array.isArray(nextData.choices)) {
      nextData.choices = (nextData.choices as unknown[]).map((c) => (typeof c === "string" ? sanitizeTranscriptText(c) : c));
    }
    out.question_data = nextData;
  }
  return out;
}

function sanitizeReadingQuestion(row: Row): Row {
  const out = { ...row };
  if (typeof out.question === "string") out.question = sanitizeTranscriptText(out.question);
  if (typeof out.explanation === "string") out.explanation = sanitizeTranscriptText(out.explanation);
  if (Array.isArray(out.options)) {
    out.options = (out.options as unknown[]).map((o) => (typeof o === "string" ? sanitizeTranscriptText(o) : o));
  }
  return out;
}

const CONTENT_CONFIG: Record<ContentType, ContentTypeConfig> = {
  kanji: {
    table: "kanji",
    orderColumn: "created_at",
    listColumns: "id, character, jlpt_level, stroke_count, meaning_en, meaning_vi, created_at",
    detailColumns:
      "id, character, jlpt_level, stroke_count, radical_id, meaning_en, meaning_vi, stroke_order_svg, mnemonic_text, mnemonic_image_url, created_at, kanji_readings(id, reading, reading_type)",
    searchColumn: "character",
    sanitizeMainRow: (row) => {
      collapseFields(row, ["meaning_en", "meaning_vi"]);
      preserveFields(row, ["mnemonic_text"]);
      // stroke_order_svg is deliberately NOT tag-stripped: it is legitimate
      // SVG markup meant to be rendered, and the trust boundary here is
      // already "signed-in admin" (requireAdmin gates every write in this
      // module) rather than "arbitrary signed-in user" (the transcript
      // ingest path this sanitizer was built for). OPEN ITEM: if the CMS
      // ever admits less-trusted contributors, stroke_order_svg needs a real
      // allowlist SVG sanitizer before being rendered, not a blanket
      // tag-strip (which would destroy it entirely).
    },
    createSchema: createKanjiSchema,
    updateSchema: updateKanjiSchema,
    csvRowSchema: kanjiCsvRowSchema,
    child: { table: "kanji_readings", parentColumn: "kanji_id", key: "readings", sanitize: sanitizeKanjiReading },
  },
  vocab: {
    table: "vocab",
    orderColumn: "created_at",
    listColumns: "id, word, reading, meaning_en, meaning_vi, jlpt_level, part_of_speech, created_at",
    detailColumns: "id, word, reading, meaning_en, meaning_vi, jlpt_level, audio_url, part_of_speech, created_at",
    searchColumn: "word",
    sanitizeMainRow: (row) => collapseFields(row, ["word", "reading", "meaning_en", "meaning_vi", "part_of_speech"]),
    createSchema: createVocabSchema,
    updateSchema: updateVocabSchema,
    csvRowSchema: vocabCsvRowSchema,
  },
  grammar: {
    table: "grammar_points",
    orderColumn: "created_at",
    listColumns: "id, title, jlpt_level, structure_pattern, created_at",
    detailColumns: "id, title, jlpt_level, explanation, structure_pattern, example_sentences, created_at",
    searchColumn: "title",
    sanitizeMainRow: sanitizeGrammarMainRow,
    createSchema: createGrammarSchema,
    updateSchema: updateGrammarSchema,
    csvRowSchema: grammarCsvRowSchema,
  },
  jlpt_tests: {
    table: "certification_tests",
    orderColumn: "created_at",
    listColumns: "id, level, title, created_at",
    detailColumns:
      "id, level, title, section_config, created_at, certification_questions(id, section, question_type, question_data, correct_answer, explanation, order_index)",
    searchColumn: "title",
    sanitizeMainRow: (row) => collapseFields(row, ["title"]),
    createSchema: createJlptTestSchema,
    updateSchema: updateJlptTestSchema,
    csvRowSchema: jlptTestCsvRowSchema,
    child: { table: "certification_questions", parentColumn: "test_id", key: "questions", sanitize: sanitizeJlptQuestion },
  },
  reading_passages: {
    table: "reading_passages",
    orderColumn: "created_at",
    listColumns: "id, title, jlpt_level, word_count, created_at",
    detailColumns:
      "id, title, jlpt_level, body_jp, body_translation, word_count, created_at, reading_questions(id, question, options, correct_answer, explanation, order_index)",
    searchColumn: "title",
    sanitizeMainRow: (row) => {
      collapseFields(row, ["title"]);
      preserveFields(row, ["body_jp", "body_translation"]);
    },
    createSchema: createReadingPassageSchema,
    updateSchema: updateReadingPassageSchema,
    csvRowSchema: readingPassageCsvRowSchema,
    child: {
      table: "reading_questions",
      parentColumn: "passage_id",
      key: "questions",
      sanitize: sanitizeReadingQuestion,
    },
  },
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const WRITE_LIMIT = { limit: 30, windowMs: 60_000 };
const IMPORT_LIMIT = { limit: 5, windowMs: 60_000 };
const MAX_CSV_ROWS = 500;

async function fetchContentDetail(service: ServiceClient, config: ContentTypeConfig, id: string): Promise<Row | null> {
  const { data, error } = await service.from(config.table).select(config.detailColumns).eq("id", id).maybeSingle();
  if (error) throw error;
  // `config.detailColumns` is a runtime string (not a literal), so
  // supabase-js can't statically infer the row shape from it — the real
  // client's return type collapses to a sentinel error type in that case.
  // The mock (test/supabase-mock.ts) has no such inference and just returns
  // whatever the test's resolver provides, so this cast is purely for the
  // real client's benefit.
  return (data as unknown as Row | null) ?? null;
}

export interface ListContentOptions {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface ListContentPage {
  items: Row[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type ListContentResult = { ok: true; data: ListContentPage } | GuardFailure;

/**
 * Paginated (page/pageSize, default 20/max 100) + optionally searched list
 * for one content type. `hasMore` is computed by fetching `pageSize + 1` rows
 * rather than a separate `count` query — cheap and sufficient for a CMS list
 * view (see `lib/data/notifications.ts`'s unread-count precedent for the
 * same "extra select instead of an aggregate" convention in this repo).
 */
export async function listContent(type: ContentType, opts: ListContentOptions): Promise<ListContentResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const config = CONTENT_CONFIG[type];
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;

  const service = createServiceClient();
  let query = service.from(config.table).select(config.listColumns).order(config.orderColumn, { ascending: true });
  if (config.searchColumn && opts.search && opts.search.trim().length > 0) {
    query = query.ilike(config.searchColumn, `%${opts.search.trim()}%`);
  }
  query = query.range(from, from + pageSize);

  const { data, error } = await query;
  if (error) throw error;

  // See fetchContentDetail's comment above re: the double cast — dynamic
  // (non-literal) select-column strings collapse the real client's type.
  const rows = (data as unknown as Row[]) ?? [];
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;

  return { ok: true, data: { items, page, pageSize, hasMore } };
}

export type WriteContentResult =
  | { ok: true; data: Row }
  | GuardFailure
  | { ok: false; status: 400; errors: unknown }
  | { ok: false; status: 404 }
  | { ok: false; status: 429; retryAfter: number };

/** Create one row (+ optional child rows) for a content type, sanitize, and
 * return the freshly-written detail row (main columns + embedded children). */
export async function createContent(type: ContentType, input: unknown): Promise<WriteContentResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:content:write:${admin.user.id}`, WRITE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const config = CONTENT_CONFIG[type];
  const parsed = config.createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, errors: parsed.error.flatten() };

  const data = parsed.data as Row;
  const child = config.child;
  const childRows = child ? (data[child.key] as Row[] | undefined) : undefined;
  const mainRow: Row = { ...data };
  if (child) delete mainRow[child.key];
  config.sanitizeMainRow(mainRow);

  const service = createServiceClient();
  const { data: inserted, error } = await service.from(config.table).insert(mainRow).select("id").single();
  if (error) return { ok: false, status: 400, errors: { message: error.message } };
  const id = (inserted as { id: string }).id;

  if (child && childRows && childRows.length > 0) {
    const rows = childRows.map((r) => ({ ...child.sanitize(r), [child.parentColumn]: id }));
    const { error: childError } = await service.from(child.table).insert(rows);
    if (childError) return { ok: false, status: 400, errors: { message: childError.message } };
  }

  const detail = await fetchContentDetail(service, config, id);
  return { ok: true, data: detail ?? { id } };
}

/**
 * Partial update. A scalar field is only touched when present in `input`
 * (standard PATCH semantics). The child-rows array works the same way at a
 * coarser grain: omit the child key entirely to leave existing child rows
 * untouched; provide it (even as `[]`) to fully replace them (delete then
 * insert) — there is no per-child-row PATCH.
 */
export async function updateContent(type: ContentType, id: string, input: unknown): Promise<WriteContentResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:content:write:${admin.user.id}`, WRITE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const config = CONTENT_CONFIG[type];
  const parsed = config.updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, errors: parsed.error.flatten() };

  const data = parsed.data as Row;
  const child = config.child;
  const hasChildKey = child ? Object.prototype.hasOwnProperty.call(data, child.key) : false;
  const childRows = child && hasChildKey ? (data[child.key] as Row[]) : undefined;
  const mainRow: Row = { ...data };
  if (child) delete mainRow[child.key];
  config.sanitizeMainRow(mainRow);

  const service = createServiceClient();

  if (Object.keys(mainRow).length > 0) {
    const { data: updated, error } = await service.from(config.table).update(mainRow).eq("id", id).select("id").maybeSingle();
    if (error) return { ok: false, status: 400, errors: { message: error.message } };
    if (!updated) return { ok: false, status: 404 };
  } else {
    const existing = await fetchContentDetail(service, config, id);
    if (!existing) return { ok: false, status: 404 };
  }

  if (child && hasChildKey) {
    const { error: deleteError } = await service.from(child.table).delete().eq(child.parentColumn, id);
    if (deleteError) return { ok: false, status: 400, errors: { message: deleteError.message } };

    if (childRows && childRows.length > 0) {
      const rows = childRows.map((r) => ({ ...child.sanitize(r), [child.parentColumn]: id }));
      const { error: insertError } = await service.from(child.table).insert(rows);
      if (insertError) return { ok: false, status: 400, errors: { message: insertError.message } };
    }
  }

  const detail = await fetchContentDetail(service, config, id);
  return { ok: true, data: detail ?? { id } };
}

export type DeleteContentResult =
  | { ok: true }
  | GuardFailure
  | { ok: false; status: 404 }
  | { ok: false; status: 429; retryAfter: number };

/** Delete a row. Child rows (if any) cascade via FK `on delete cascade`
 * (`kanji_readings.kanji_id`, `certification_questions.test_id`,
 * `reading_questions.passage_id` — see migrations 1/11) — no explicit child
 * delete needed here. */
export async function deleteContent(type: ContentType, id: string): Promise<DeleteContentResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:content:write:${admin.user.id}`, WRITE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const config = CONTENT_CONFIG[type];
  const service = createServiceClient();
  const { data, error } = await service.from(config.table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true };
}

export interface CsvImportRowError {
  row: number;
  errors: string[];
}

export type CsvImportResult =
  | { ok: true; data: { inserted: number; failed: CsvImportRowError[] } }
  | GuardFailure
  | { ok: false; status: 400 }
  | { ok: false; status: 429; retryAfter: number };

/** CSV cells are always strings; map `""` -> `undefined` so a schema's
 * `.optional()` fields behave as "absent" rather than failing type/format
 * checks against an empty string. */
function emptyToUndefined(fields: Record<string, string>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = value === "" ? undefined : value;
  }
  return out;
}

function flattenZodError(error: { issues: { path: (string | number)[]; message: string }[] }): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

/**
 * Bulk-import content rows from CSV text. Each row is validated
 * independently against the type's `csvRowSchema` (a flatter variant of the
 * create schema — no nested child rows; see `lib/validation/admin-content.ts`
 * doc comments for what's excluded per type and why) and inserted one row at
 * a time — NOT as a single batch `insert(array)` — specifically so one bad
 * row's DB-level failure (e.g. a unique-constraint violation) can't abort an
 * otherwise-valid batch; "partial success" requires that per-row isolation.
 * Rate-limited tighter than other content writes (5/60s) since it can
 * trigger many inserts from one request.
 */
export async function importContentCsv(type: ContentType, csvText: string): Promise<CsvImportResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:content:import:${admin.user.id}`, IMPORT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  if (csvText.trim().length === 0) return { ok: false, status: 400 };

  const config = CONTENT_CONFIG[type];
  const { records } = parseCsv(csvText);
  if (records.length === 0 || records.length > MAX_CSV_ROWS) return { ok: false, status: 400 };

  const service = createServiceClient();
  let inserted = 0;
  const failed: CsvImportRowError[] = [];

  for (const record of records) {
    const parsed = config.csvRowSchema.safeParse(emptyToUndefined(record.fields));
    if (!parsed.success) {
      failed.push({ row: record.rowNumber, errors: flattenZodError(parsed.error) });
      continue;
    }

    const row: Row = { ...(parsed.data as Row) };
    config.sanitizeMainRow(row);

    const { error } = await service.from(config.table).insert(row);
    if (error) {
      failed.push({ row: record.rowNumber, errors: [error.message] });
      continue;
    }
    inserted += 1;
  }

  return { ok: true, data: { inserted, failed } };
}
