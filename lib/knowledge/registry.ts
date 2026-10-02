import type { KnowledgeSection, SectionDefinition } from "./types";
import { alternativeExpressionsSection } from "./sections/alternative-expressions";
import { commonMistakesSection } from "./sections/common-mistakes";
import { conversationSection } from "./sections/conversation";
import { cultureNotesSection } from "./sections/culture-notes";
import { grammarBreakdownSection } from "./sections/grammar-breakdown";
import { liteSection } from "./sections/lite";
import { moreExamplesSection } from "./sections/more-examples";
import { nativeNuanceSection } from "./sections/native-nuance";
import { phraseAnalysisSection } from "./sections/phrase-analysis";
import { quizSection } from "./sections/quiz";
import { wordGlossViSection } from "./sections/word-gloss-vi";

export type { SectionDefinition, SectionPromptInput } from "./types";

/**
 * The one section registry (spec §5.3). Routes, orchestration and UI read it; nothing else switches on a
 * section name. A Record, so a section missing here does not compile.
 */
export const SECTION_REGISTRY: Record<KnowledgeSection, SectionDefinition> = {
  lite: liteSection,
  grammar_breakdown: grammarBreakdownSection,
  culture_notes: cultureNotesSection,
  common_mistakes: commonMistakesSection,
  alternative_expressions: alternativeExpressionsSection,
  native_nuance: nativeNuanceSection,
  more_examples: moreExamplesSection,
  quiz: quizSection,
  conversation: conversationSection,
  phrase_analysis: phraseAnalysisSection,
  word_gloss_vi: wordGlossViSection,
};

export function sectionDefinition(section: string): SectionDefinition | null {
  return Object.hasOwn(SECTION_REGISTRY, section) ? SECTION_REGISTRY[section as KnowledgeSection] : null;
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
