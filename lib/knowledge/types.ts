import type { LeaseStore } from "./leased";
import type { z } from "zod/v4";
import type { SystemBlock } from "@/lib/ai/port";
import type { PlanTier } from "@/lib/data/subscriptions";

export type { PlanTier };

/** The nine cascade sections of ✨ (spec R4), in display order. */
export const KNOWLEDGE_SECTIONS = [
  "lite",
  "grammar_breakdown",
  "culture_notes",
  "common_mistakes",
  "alternative_expressions",
  "native_nuance",
  "more_examples",
  "quiz",
  "conversation",
] as const;

export type CascadeSection = (typeof KNOWLEDGE_SECTIONS)[number];
export type KnowledgeSection = CascadeSection | "phrase_analysis" | "word_gloss_vi";
export type ContentVariant = "full" | "preview";
export type KnowledgeLocale = "vi" | "en";
/** Who may read a section in full: Free in full, Free as a preview, or system-funded for everyone. */
export type SectionAccess = "free_full" | "free_preview" | "system";

/** The seven dimensions of a cache entry's identity (spec §4.2). */
export interface KnowledgeKey {
  fingerprint: string;
  /** `lesson_analysis` is a lesson-level entry outside SECTION_REGISTRY (summary plan correction C1). */
  section: KnowledgeSection | "lesson_analysis";
  locale: KnowledgeLocale;
  contextKey: string;
  schemaVersion: number;
  generatorVersion: number;
  contentVariant: ContentVariant;
}

/** What a section prompt may read. Sentence text is data: prompts put it in a delimited block, never in instructions. */
export interface SectionPromptInput {
  sentence: string;
  phrase?: string;
  locale: KnowledgeLocale;
  videoTitle?: string;
  jlpt?: string | null;
  headword?: string;
  reading?: string;
  senseGlossesEn?: string[];
}

/** One section, declared once (spec §5.3). The registry (Task 8a) maps names to these; nothing else switches on names. */
export interface SectionDefinition<Full = unknown, Preview = unknown> {
  section: KnowledgeSection;
  schema: z.ZodType<Full>;
  /** null = no preview variant (Free reads it in full, or it is system-funded). */
  previewSchema: z.ZodType<Preview> | null;
  schemaVersion: number;
  generatorVersion: number;
  contextPolicy: "none" | "video" | "parent_sentence" | "dictionary_sense";
  access: SectionAccess;
  maxOutputTokens: { full: number; preview: number | null };
  buildPrompt(input: SectionPromptInput, variant: ContentVariant): { system: SystemBlock[]; user: string };
  /** Deterministic; null exactly when previewSchema is null. */
  projectPreview(full: Full): Preview | null;
}

export type ClaimResult =
  | { outcome: "ready"; entryId: string; content: unknown; model: string | null }
  | { outcome: "leader"; entryId: string; leaseToken: string; attempts: number }
  | { outcome: "follower"; entryId: string }
  | { outcome: "backoff"; entryId: string; retryAfter: string };

export type ReserveOutcome =
  | "reserved"
  | "already_charged"
  | "quota_exhausted"
  | "credits_exhausted"
  | "fuse_tripped"
  | "budget_exhausted"
  | "turn_exists";

export interface ReserveLimits {
  globalUsdPerDay: number;
  freeSentencesPerDay: number;
  plusMaxSectionsPerDay: number;
  plusCreditsPerMonth: number;
  askKorumeFreeTurnsPerDay: number;
  askKorumePlusTurnsPerDay: number;
  systemGenerationsPerUserPerDay: number;
}

export interface ReserveInput {
  requestedBy: string | null;
  billingScope: "learner" | "system";
  entitlementKind: "free_sentence" | "plus_section" | "korume_free_turn" | "korume_plus_turn" | null;
  turnId?: string;
  fingerprint: string;
  reservedCredits: number;
  reservedUsd: number;
  limits: ReserveLimits;
  ttlSeconds: number;
}

export interface GenerationRow {
  requestedByUserId: string | null;
  billingScope: "learner" | "system";
  knowledgeEntryId: string | null;
  reservationId: string;
  section: KnowledgeSection | "korume_plan" | "korume_answer" | "lesson_analysis" | "lesson_reflection";
  turnId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  outcome: "success" | "provider_error" | "validation_error";
}

/**
 * The SQL contract of migration 038, one method per function (plus a read of a ready entry). The lease half is
 * `LeaseStore<KnowledgeKey>` (lib/knowledge/leased.ts); its `readReady` never writes — the kill-switch path reads
 * through it.
 */
export interface KnowledgeStore extends LeaseStore<KnowledgeKey> {
  reserve(input: ReserveInput): Promise<{ outcome: ReserveOutcome; reservationId: string | null; resetsAt: string | null }>;
  recordGeneration(row: GenerationRow): Promise<string>;
  settle(reservationId: string, generationId: string, actualCredits: number, actualUsd: number): Promise<boolean>;
  release(reservationId: string, spentUsd: number): Promise<boolean>;
}
