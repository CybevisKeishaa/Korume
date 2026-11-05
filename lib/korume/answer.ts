import { z } from "zod/v4";
import type { GroundedEntity } from "./types";

export type Run = { text: string; strong?: boolean } | { jp: string };
export type BlockV1 =
  | { type: "paragraph"; runs: Run[] }
  | { type: "example"; jp: string; ruby: { base: string; reading?: string }[]; translation: string }
  | { type: "context_card"; entityRef: string; note?: string }
  | { type: "followups"; chips: string[] };
export type HeadingBlock = { type: "heading"; level: 1 | 2; runs: Run[] };
export type ListBlock = { type: "list"; style: "bullet" | "number" | "check"; items: { mark?: "good" | "bad"; runs: Run[] }[] };
export type TableBlock = { type: "table"; header: Run[][]; rows: Run[][][] };
export type Block = BlockV1 | HeadingBlock | ListBlock | TableBlock;
export interface AnswerV1 { blocks: BlockV1[] }
export interface Answer { blocks: Block[] }

export const ANSWER_SCHEMA_VERSION = 2;
export const MAX_ANSWER_BLOCKS = 32;
export const GROUNDING_SCHEMA_VERSION = 1;

const run = z.union([
  z.object({ text: z.string().min(1).max(2000), strong: z.boolean().optional() }).strict(),
  z.object({ jp: z.string().min(1).max(200) }).strict(),
]);

const blockV1Options = [
  z.object({ type: z.literal("paragraph"), runs: z.array(run).min(1).max(40) }).strict(),
  z.object({
    type: z.literal("example"),
    jp: z.string().min(1).max(200),
    ruby: z.array(z.object({ base: z.string().min(1).max(20), reading: z.string().max(40).optional() }).strict()).max(40),
    translation: z.string().max(400),
  }).strict(),
  z.object({ type: z.literal("context_card"), entityRef: z.string().min(1).max(80), note: z.string().max(300).optional() }).strict(),
  z.object({ type: z.literal("followups"), chips: z.array(z.string().min(1).max(40)).min(1).max(4) }).strict(),
] as const;
const blockV1 = z.discriminatedUnion("type", blockV1Options);

const cell = z.array(run).min(1).max(8);
const block = z.discriminatedUnion("type", [
  ...blockV1Options,
  z.object({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2)]), runs: z.array(run).min(1).max(8) }).strict(),
  z.object({
    type: z.literal("list"),
    style: z.enum(["bullet", "number", "check"]),
    items: z.array(z.object({ mark: z.enum(["good", "bad"]).optional(), runs: z.array(run).min(1).max(40) }).strict()).min(1).max(12),
  }).strict(),
  z.object({
    type: z.literal("table"),
    header: z.array(cell).min(2).max(4),
    rows: z.array(z.array(cell).min(1).max(4)).min(1).max(12),
  }).strict(),
]);

/**
 * Gemini does not always honour the schema it is sent (seen live 2026-10-31: an invented block type, then a 41+ char
 * followup chip), and one bad block used to throw away the whole answer. Drop each block that fails on its own, as
 * {@link dropUngroundedCards} does for an unknown card. Nothing invalid is ever kept — a bad block is removed, never
 * repaired — and an answer with nothing left still fails `min(1)`.
 */
const dropInvalidBlocks = (schema: z.ZodType) => (blocks: unknown) =>
  Array.isArray(blocks) ? blocks.filter((b) => schema.safeParse(b).success) : blocks;

/**
 * v1 rows only (spec §6.1): heading/list/table blocks are dropped. The shape an answer could take before rich answers: typed blocks rendered as escaped text — never HTML or Markdown.
 * Bounded everywhere so one answer cannot flood the sheet or the database.
 */
export const answerV1Schema: z.ZodType<AnswerV1> = z.object({
  blocks: z.preprocess(dropInvalidBlocks(blockV1), z.array(blockV1).min(1).max(12)),
}).strict();

/** The shape new answers take (rich-answers spec §4): v1 blocks plus heading, list and table; invalid blocks dropped alike. */
export const answerV2Schema: z.ZodType<Answer> = z.object({
  blocks: z.preprocess(dropInvalidBlocks(block), z.array(block).min(1).max(MAX_ANSWER_BLOCKS)),
}).strict();

/** Cut to `max` blocks, keeping a trailing followups block (the chips are the answer's exit). */
export function capBlocks(answer: Answer, max: number): Answer {
  const { blocks } = answer;
  if (blocks.length <= max) return answer;
  const last = blocks[blocks.length - 1] as Block;
  return { blocks: last.type === "followups" ? [...blocks.slice(0, max - 1), last] : blocks.slice(0, max) };
}

export const GLOSS_MAX = 300;
export const GROUNDING_MAX = 40;

export const groundedEntitySchema: z.ZodType<GroundedEntity> = z.object({
  id: z.string().regex(/^(ent|tok):/).max(120),
  label: z.string().min(1).max(80),
  reading: z.string().max(80).optional(),
  kind: z.enum(["vocabulary", "grammar", "particle"]),
  jlpt: z.enum(["N5", "N4", "N3", "N2", "N1"]).optional(),
  gloss: z.string().max(GLOSS_MAX).optional(),
  seenCount: z.number().int().min(0).optional(),
  seenCapped: z.boolean().optional(),
  lessonLink: z.object({ videoId: z.string().uuid(), lineId: z.string().uuid().optional() }).strict().optional(),
}).strict();

/** Persisted grounding, re-validated on every read so a malformed row can never reach the rail. */
export const groundingSchema: z.ZodType<GroundedEntity[]> = z.array(groundedEntitySchema).max(GROUNDING_MAX);

/** A context card may only name an entity the server grounded (spec §5.4); anything else is dropped. */
export function dropUngroundedCards(answer: Answer, grounding: GroundedEntity[]): Answer {
  const ids = new Set(grounding.map((e) => e.id));
  return { blocks: answer.blocks.filter((b) => b.type !== "context_card" || ids.has(b.entityRef)) };
}

/** The `content` column: a readable plain-text rendering for export and search. No markup, ever. */
export function answerToPlainText(answer: Answer, grounding: GroundedEntity[]): string {
  const labels = new Map(grounding.map((e) => [e.id, e.label]));
  const runsText = (rs: Run[]) => rs.map((r) => ("jp" in r ? r.jp : r.text)).join("");
  return answer.blocks.flatMap((b): string[] => {
    switch (b.type) {
      case "paragraph":
      case "heading": return [runsText(b.runs)];
      case "list": return [b.items.map((it, i) => {
        const bullet = b.style === "number" ? `${i + 1}.` : b.style === "check" && it.mark ? (it.mark === "good" ? "✓" : "✗") : "-";
        return `${bullet} ${runsText(it.runs)}`;
      }).join("\n")];
      case "table": return [[b.header, ...b.rows].map((row) => row.map(runsText).join(" | ")).join("\n")];
      case "example": return [b.translation ? `${b.jp} — ${b.translation}` : b.jp];
      case "context_card": {
        const label = labels.get(b.entityRef);
        if (!label) return [];
        return [b.note ? `${label}: ${b.note}` : label];
      }
      case "followups": return [];
    }
  }).join("\n\n");
}
