import type { KnowledgeSection, SectionDefinition } from "./types";
import { commonMistakesSection } from "./sections/common-mistakes";
import { grammarBreakdownSection } from "./sections/grammar-breakdown";
import { liteSection } from "./sections/lite";
import { moreExamplesSection } from "./sections/more-examples";
import { phraseAnalysisSection } from "./sections/phrase-analysis";
import { wordGlossViSection } from "./sections/word-gloss-vi";

export type { SectionDefinition, SectionPromptInput } from "./types";

/**
 * The one section registry (spec §5.3). Routes, orchestration and UI read it; nothing else switches on a
 * section name. Task 8b registers the remaining five cascade sections.
 */
export const SECTION_REGISTRY: Partial<Record<KnowledgeSection, SectionDefinition>> = {
  lite: liteSection,
  grammar_breakdown: grammarBreakdownSection,
  common_mistakes: commonMistakesSection,
  more_examples: moreExamplesSection,
  phrase_analysis: phraseAnalysisSection,
  word_gloss_vi: wordGlossViSection,
};

export function sectionDefinition(section: string): SectionDefinition | null {
  return Object.hasOwn(SECTION_REGISTRY, section) ? SECTION_REGISTRY[section as KnowledgeSection] ?? null : null;
}

/** The context dimension of a cache key (spec §4.2), from the section's own policy. */
export function contextKeyFor(
  definition: SectionDefinition,
  context: { videoId: string | null; parentFingerprint: string | null; senseKey?: string | null },
): string {
  const value = {
    none: "",
    video: context.videoId,
    parent_sentence: context.parentFingerprint,
    dictionary_sense: context.senseKey,
  }[definition.contextPolicy];
  if (value === null || value === undefined) throw new Error(`${definition.section} needs its ${definition.contextPolicy} context`);
  return value;
}
