import type { DictionaryAttribution as Attribution } from "@/lib/dictionary/types";

const SOURCE_NAMES: Record<Attribution["source"], string> = {
  jmdict: "JMdict",
  kanjidic2: "KANJIDIC2",
  kanjivg: "KanjiVG",
};

/**
 * Credits exactly the sources and licences of the active snapshot (spec §4.1) — never hard-coded text.
 * `compact` keeps it to one line (the one-viewport inspect): each licence moves into its source link's title.
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
          {!compact && ` (${item.license})`}
        </span>
      ))}
    </footer>
  );
}
