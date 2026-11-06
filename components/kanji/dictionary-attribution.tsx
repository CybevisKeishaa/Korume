import type { DictionaryAttribution as Attribution } from "@/lib/dictionary/types";

const SOURCE_NAMES: Record<Attribution["source"], string> = {
  jmdict: "JMdict",
  kanjidic2: "KANJIDIC2",
  kanjivg: "KanjiVG",
};

const CC_TERMS: Record<string, string> = { Attribution: "BY", ShareAlike: "SA", NonCommercial: "NC", NoDerivs: "ND", NoDerivatives: "ND" };

/** The licence's short name read off the stored licence text ("…Creative Commons Attribution-ShareAlike 4.0…" →
 *  "CC BY-SA 4.0"); a licence that is not a Creative Commons one is shown as stored. */
export function licenceName(license: string): string {
  const match = /Creative Commons ([A-Za-z-]+) (\d+\.\d+)/.exec(license);
  const terms = match?.[1]?.split("-").map((term) => CC_TERMS[term]);
  return match && terms?.every(Boolean) ? `CC ${terms.join("-")} ${match[2]}` : license;
}

/**
 * Credits exactly the sources and licences of the active snapshot (spec §4.1) — never hard-coded text.
 * `compact` keeps it to one line (the one-viewport inspect): each licence by its short name, the full licence
 * text in the source link's title (owner K10: the licence name stays visible).
 */
export function DictionaryAttribution({ label, attribution, compact = false }: { label: string; attribution: Attribution[]; compact?: boolean }) {
  if (attribution.length === 0) return null;
  return (
    <footer className="text-caption text-muted-foreground">
      <span>{label}: </span>
      {attribution.map((item, index) => (
        <span key={item.source}>
          {index > 0 && " · "}
          <a href={item.url} target="_blank" rel="noopener noreferrer" title={compact ? item.license : undefined} className="underline-offset-2 hover:underline">
            {`${SOURCE_NAMES[item.source]} ${item.version}`}
          </a>
          {` (${compact ? licenceName(item.license) : item.license})`}
        </span>
      ))}
    </footer>
  );
}
