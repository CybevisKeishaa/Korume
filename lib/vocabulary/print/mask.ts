import type { VocabularyPrintItem } from "./source";

/** Spec W §1.4: fixed length — the cell group already tells the count, and an inflection's length would mislead. */
export const MASK_BLANK = "＿＿";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Spec W §1.4: every printed target, plus every span (in any printed example) that resolves to a printed item. */
export function maskSet(items: VocabularyPrintItem[]): string[] {
  const printed = new Set(items.flatMap((item) => (item.entSeq === undefined ? [] : [item.entSeq])));
  const strings = new Set<string>();
  for (const item of items) {
    strings.add(item.surface);
    for (const span of item.example?.spans ?? []) if (printed.has(span.entSeq)) strings.add(span.surface);
  }
  return [...strings].filter((text) => text.length > 0).sort((a, b) => b.length - a.length);
}

/** One pass, longest alternative first; over-masking a short kana target inside another word is accepted. */
export function maskText(text: string, mask: readonly string[]): string {
  if (mask.length === 0) return text;
  return text.replace(new RegExp(mask.map(escape).join("|"), "gu"), MASK_BLANK);
}

/** An item whose own answer is not found in its example could still leak through an unmasked inflection. */
export function ownAnswerLocatable(item: VocabularyPrintItem): boolean {
  const example = item.example;
  if (!example) return false;
  const bySpan = item.entSeq !== undefined
    && example.spans.some((span) => span.entSeq === item.entSeq && example.text.includes(span.surface));
  return bySpan || example.text.includes(item.surface);
}
