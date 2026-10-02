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
  section: KnowledgeSection;
  locale: KnowledgeLocale;
  contextKey: string;
  schemaVersion: number;
  generatorVersion: number;
  contentVariant: ContentVariant;
}
