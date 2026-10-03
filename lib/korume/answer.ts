import { z } from "zod/v4";
import type { GroundedEntity } from "./types";

export type Run = { text: string; strong?: boolean } | { jp: string };
export type Block =
  | { type: "paragraph"; runs: Run[] }
  | { type: "example"; jp: string; ruby: { base: string; reading?: string }[]; translation: string }
  | { type: "context_card"; entityRef: string; note?: string }
  | { type: "followups"; chips: string[] };
export interface AnswerV1 { blocks: Block[] }

export const ANSWER_SCHEMA_VERSION = 1;
export const GROUNDING_SCHEMA_VERSION = 1;

const run = z.union([
  z.object({ text: z.string().min(1).max(2000), strong: z.boolean().optional() }).strict(),
  z.object({ jp: z.string().min(1).max(200) }).strict(),
]);

/**
 * The only shape an answer may take (spec §6.1): typed blocks rendered as escaped text — never HTML or Markdown.
 * Bounded everywhere so one answer cannot flood the sheet or the database.
 */
export const answerV1Schema: z.ZodType<AnswerV1> = z.object({
  blocks: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), runs: z.array(run).min(1).max(40) }).strict(),
    z.object({
      type: z.literal("example"),
      jp: z.string().min(1).max(200),
      ruby: z.array(z.object({ base: z.string().min(1).max(20), reading: z.string().max(40).optional() }).strict()).max(40),
      translation: z.string().max(400),
    }).strict(),
    z.object({ type: z.literal("context_card"), entityRef: z.string().min(1).max(80), note: z.string().max(300).optional() }).strict(),
    z.object({ type: z.literal("followups"), chips: z.array(z.string().min(1).max(40)).min(1).max(4) }).strict(),
  ])).min(1).max(12),
}).strict();

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
export function dropUngroundedCards(answer: AnswerV1, grounding: GroundedEntity[]): AnswerV1 {
  const ids = new Set(grounding.map((e) => e.id));
  return { blocks: answer.blocks.filter((b) => b.type !== "context_card" || ids.has(b.entityRef)) };
}

/** The `content` column: a readable plain-text rendering for export and search. No markup, ever. */
export function answerToPlainText(answer: AnswerV1, grounding: GroundedEntity[]): string {
  const labels = new Map(grounding.map((e) => [e.id, e.label]));
  return answer.blocks.flatMap((b): string[] => {
    switch (b.type) {
      case "paragraph": return [b.runs.map((r) => ("jp" in r ? r.jp : r.text)).join("")];
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
