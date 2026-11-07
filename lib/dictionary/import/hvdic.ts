/** One hvdic reading block that carries a "Từ điển phổ thông" gloss list (owner ruling K16). */
export type HvdicBlock = { reading: string; glosses: string[] };
export type HvdicIndex = Record<string, HvdicBlock[]>;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#(x?)([0-9a-f]+);/gi, (_, hex: string, code: string) => String.fromCodePoint(parseInt(code, hex ? 16 : 10)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
}

const TONES = /[̣̀́̃̉]/gu;

/**
 * KANJIDIC2 writes the new orthography (hòa, kí) and hvdic the old (hoà, ký): the key keeps every letter and the tone
 * but not where the tone sits, and reads a final y after a consonant as i.
 */
export function readingKey(reading: string): string {
  const nfd = reading.normalize("NFD").toLocaleLowerCase("vi");
  const tone = nfd.match(TONES)?.join("") ?? "";
  return `${nfd.replace(TONES, "").replace(/(?<=[bcdđghklmnpqrstvx])y$/u, "i")}${tone}`.normalize("NFC");
}

/**
 * Owner ruling K16, in order: the override file; the literal's hvdic blocks, else its kyūjitai's; among those, the block
 * whose reading is one of the KANJIDIC2 Hán Việt readings — several match → the one with the most glosses (会: 1 vs 3),
 * ties in KANJIDIC2 order — none matches → the first block. No block → [] (the meaning stays absent).
 * ponytail: gloss count stands in for "the reading Japanese uses"; the owner-reviewed override file corrects misses.
 */
export function resolveViMeaning(
  literal: string,
  viReadings: string[],
  hvdic: HvdicIndex,
  oldForms: Record<string, string[]>,
  overrides: Record<string, string[]> = {},
): string[] {
  const override = overrides[literal];
  if (override) return override;
  const blocks = hvdic[literal] ?? (oldForms[literal] ?? []).map((old) => hvdic[old]).find(Boolean) ?? [];
  let best: HvdicBlock | undefined;
  for (const reading of viReadings) {
    const block = blocks.find((candidate) => readingKey(candidate.reading) === readingKey(reading));
    if (block && block.glosses.length > (best?.glosses.length ?? 0)) best = block;
  }
  return (best ?? blocks[0])?.glosses ?? [];
}

/** The phổ thông glosses of each reading block of one hvdic page, numbering ("1. ") and markup stripped. */
export function parseHvdicPage(html: string): HvdicBlock[] {
  return html.split(/<div class="hvres"[\s>]/).slice(1).flatMap((block) => {
    const spell = /class="hvres-spell"><a [^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!spell) return [];
    const glosses = Array.from(block.matchAll(/class="hvres-source">Từ điển phổ thông<\/p>\s*<div class="hvres-meaning[^"]*">([\s\S]*?)<\/div>/g))
      .flatMap((match) => (match[1] ?? "").split(/<br\s*\/?>/i))
      .map((line) => text(line).replace(/^\d+\.\s*/, ""))
      .filter(Boolean);
    return glosses.length > 0 ? [{ reading: text(spell[1] ?? ""), glosses }] : [];
  });
}
