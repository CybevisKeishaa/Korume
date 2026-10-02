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
/** The section Grammar's "AI Grammar Breakdown →" shortcut asks the AI tab for — named here, beside the list. */
export const AI_GRAMMAR_SHORTCUT: CascadeSection = "grammar_breakdown";
/** The section the explicit action that opens the AI tab generates (spec §6.4). */
export const OPENING_SECTION: CascadeSection = "lite";
/** The section a span target asks for; it heads the AI tab. */
export const PHRASE_SECTION = "phrase_analysis" satisfies KnowledgeSection;
export type KnowledgeSection = CascadeSection | "phrase_analysis" | "word_gloss_vi";
/** How the AI tab draws a section's structured fields — named here so no component switches on a section name. */
export type SectionView = "summary" | "patterns" | "notes" | "mistakes" | "expressions" | "nuance" | "examples" | "quiz" | "dialogue" | "phrase";
export const SECTION_VIEW: Record<CascadeSection | typeof PHRASE_SECTION, SectionView> = {
  lite: "summary",
  grammar_breakdown: "patterns",
  culture_notes: "notes",
  common_mistakes: "mistakes",
  alternative_expressions: "expressions",
  native_nuance: "nuance",
  more_examples: "examples",
  quiz: "quiz",
  conversation: "dialogue",
  phrase_analysis: "phrase",
};
export type ContentVariant = "full" | "preview";
export type KnowledgeLocale = "vi" | "en";
/** Who may read a section in full: Free in full, Free as a preview, or system-funded for everyone. */
export type SectionAccess = "free_full" | "free_preview" | "system";

/** The seven dimensions of a cache entry's identity (spec §4.2). */
export interface KnowledgeKey {
  fingerprint: string;
  section: KnowledgeSection;
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
  | "budget_exhausted";

export interface ReserveLimits {
  globalUsdPerDay: number;
  freeSentencesPerDay: number;
  plusMaxSectionsPerDay: number;
  plusCreditsPerMonth: number;
}

export interface ReserveInput {
  requestedBy: string | null;
  billingScope: "learner" | "system";
  entitlementKind: "free_sentence" | "plus_section" | null;
  fingerprint: string;
  reservedCredits: number;
  reservedUsd: number;
  limits: ReserveLimits;
  ttlSeconds: number;
}

export interface GenerationRow {
  requestedByUserId: string | null;
  billingScope: "learner" | "system";
  knowledgeEntryId: string;
  reservationId: string;
  section: KnowledgeSection;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  outcome: "success" | "provider_error" | "validation_error";
}

/** The SQL contract of migration 038, one method per function (plus a read of a ready entry). */
export interface KnowledgeStore {
  claimLease(key: KnowledgeKey, leaseSeconds: number): Promise<ClaimResult>;
  /** A ready entry's content, or null. Never writes — the kill-switch path reads through this. */
  readReady(key: KnowledgeKey): Promise<{ content: unknown; model: string | null } | null>;
  complete(entryId: string, leaseToken: string, content: unknown, model: string, provider: string): Promise<boolean>;
  fail(entryId: string, leaseToken: string, errorCode: string, retryAfter: Date): Promise<boolean>;
  reserve(input: ReserveInput): Promise<{ outcome: ReserveOutcome; reservationId: string | null; resetsAt: string | null }>;
  recordGeneration(row: GenerationRow): Promise<string>;
  settle(reservationId: string, generationId: string, actualCredits: number, actualUsd: number): Promise<boolean>;
  release(reservationId: string, spentUsd: number): Promise<boolean>;
}
