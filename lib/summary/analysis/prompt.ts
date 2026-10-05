import type { SystemBlock } from "@/lib/ai/port";
import { dataBlocks, sectionSystem } from "@/lib/knowledge/sections/prompt";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import type { AnalysisInput } from "./input";

const INSTRUCTION = [
  "You are preparing the Summary page of one Japanese lesson. The data blocks are <lesson_title>; <lines>, the whole transcript as \"id: text\"; and <vocabulary_candidates> and <grammar_candidates>, each line \"candidate id | line id | text\". A missing candidate block means there are no candidates of that kind.",
  "overview: one or two sentences about what happens in this lesson.",
  "words: pick 3 to 6 vocabulary candidates worth remembering (fewer only if fewer exist); candidate_id copied from <vocabulary_candidates>; why_it_matters: why a learner will use it again; usage_note: how it is used in this lesson.",
  "expressions: 2 to 5 natural set phrases spoken in the lesson; line: the line id; span: the phrase copied character for character from that line; meaning_use; nuance; commonness: very_common, common or situational.",
  "grammar: pick 2 to 4 grammar candidates (fewer only if fewer exist); candidate_id copied from <grammar_candidates>; meaning_short: a few words; explanation: one or two sentences about its use in this lesson; try_it: one NEW short Japanese practice sentence that uses the pattern.",
  "culture: 0 to 3 notes, each interpreting how one specific line works socially or pragmatically (politeness, softening, what is left unsaid), anchored by its line id. Never state history, statistics, laws, etymology or broad customs that the line itself does not show; never generalize to Japanese people, Japanese culture or Japanese society as a whole (no \"in Japan…\", \"Japanese people…\", \"in Japanese families…\") — describe only what this speaker does with this line; if nothing qualifies, return an empty list.",
  "Never write readings, romanization, dictionary meanings or JLPT levels in any field: the app shows those from its dictionary. Use only the ids given.",
].join("\n");

export function buildAnalysisPrompt(input: AnalysisInput, locale: KnowledgeLocale, lessonTitle: string): { system: SystemBlock[]; user: string } {
  const shortOf = new Map(input.lines.map((line) => [line.id, line.shortId]));
  return {
    system: sectionSystem(locale, INSTRUCTION),
    user: dataBlocks({
      lesson_title: lessonTitle,
      lines: input.lines.map((line) => `${line.shortId}: ${line.textJp}`).join("\n"),
      vocabulary_candidates: input.vocabulary.map((item) => `${item.shortId} | ${shortOf.get(item.lineId)} | ${item.surface}`).join("\n"),
      grammar_candidates: input.grammar.map((item) => `${item.shortId} | ${shortOf.get(item.lineId)} | ${item.span}`).join("\n"),
    }),
  };
}
