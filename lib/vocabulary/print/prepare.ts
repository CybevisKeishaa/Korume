import type { MeaningLocale } from "@/lib/analysis/meaning";
import { graphemes, hasKanji, readingRevealsTarget } from "./japanese";
import { maskSet, maskText, ownAnswerLocatable } from "./mask";
import type { WorksheetSettings } from "./settings";
import type { VocabularyPrintItem } from "./source";

export interface PreparedItem {
  id: string;
  number: number;
  cells: number;
  /** Practice only. Self-test items never carry the answer (spec W W6). */
  target?: string;
  glyphs?: string[];
  reading?: string;
  meaning?: string;
  meaningLocale?: MeaningLocale;
  example?: string;
}
export interface AnswerRow { id: string; number: number; target: string; reading?: string }
export type PreparedPage = { kind: "items"; items: PreparedItem[] } | { kind: "answers"; answers: AnswerRow[] };
export interface PreparedDocument { items: PreparedItem[]; answers: AnswerRow[]; excluded: string[] }

type Prompts = Pick<PreparedItem, "reading" | "meaning" | "meaningLocale"> & { exampleSource?: VocabularyPrintItem };

/** Spec W §2: the enabled prompts that do not reveal the answer, then the meaning / example fallback. */
function selfTestPrompts(item: VocabularyPrintItem, settings: WorksheetSettings): Prompts | null {
  const reading = settings.showReading && item.reading && !readingRevealsTarget(item.surface, item.reading) ? item.reading : undefined;
  const meaning = settings.showMeaning && item.meaning ? item.meaning : undefined;
  const example = settings.showExample && ownAnswerLocatable(item);
  if (reading || meaning || example) {
    return { reading, meaning, meaningLocale: meaning ? item.meaningLocale : undefined, exampleSource: example ? item : undefined };
  }
  if (item.meaning) return { meaning: item.meaning, meaningLocale: item.meaningLocale };
  if (ownAnswerLocatable(item)) return { exampleSource: item };
  return null;
}

const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

/** Spec W §1–§3: the only input the sheets render — preview, print root, measurement tree and the PDF page. */
export function prepareDocument(items: VocabularyPrintItem[], selected: ReadonlySet<string>, settings: WorksheetSettings): PreparedDocument {
  const candidates = items.filter((item) => selected.has(item.id) && (settings.includeKanaOnly || hasKanji(item.surface)));

  if (settings.mode === "practice") {
    return {
      items: candidates.map((item, index) => defined({
        id: item.id, number: index + 1, cells: graphemes(item.surface).length, target: item.surface, glyphs: graphemes(item.surface),
        reading: settings.showReading ? item.reading : undefined,
        meaning: settings.showMeaning ? item.meaning : undefined,
        meaningLocale: settings.showMeaning && item.meaning ? item.meaningLocale : undefined,
        example: settings.showExample ? item.example?.text : undefined,
      })),
      answers: [],
      excluded: [],
    };
  }

  const excluded: string[] = [];
  const kept: { item: VocabularyPrintItem; prompts: Prompts }[] = [];
  for (const item of candidates) {
    const prompts = selfTestPrompts(item, settings);
    if (prompts) kept.push({ item, prompts }); else excluded.push(item.id);
  }
  const mask = maskSet(kept.map(({ item }) => item));
  return {
    items: kept.map(({ item, prompts }, index) => defined({
      id: item.id, number: index + 1, cells: graphemes(item.surface).length,
      reading: prompts.reading, meaning: prompts.meaning, meaningLocale: prompts.meaningLocale,
      example: prompts.exampleSource?.example ? maskText(prompts.exampleSource.example.text, mask) : undefined,
    })),
    answers: kept.map(({ item }, index) => defined({
      id: item.id, number: index + 1, target: item.surface,
      reading: item.reading && !readingRevealsTarget(item.surface, item.reading) ? item.reading : undefined,
    })),
    excluded,
  };
}
