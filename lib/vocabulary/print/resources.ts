import "server-only";
import { getActiveSnapshotId, getDictionaryAttribution } from "@/lib/dictionary/snapshot";
import { getStrokeGuides } from "@/lib/strokes/guides";
import { graphemes } from "./japanese";
import type { PrintResources } from "./source";

const NAMES = { jmdict: "JMdict", kanjivg: "KanjiVG" } as const;

/** Spec W §1.1 + §1.5: stroke guides for every grapheme the sheets may print, and the real data credits. */
export async function loadPrintResources(targets: string[]): Promise<PrintResources> {
  const characters = [...new Set(targets.flatMap(graphemes))];
  const [strokeGuides, snapshotId] = await Promise.all([getStrokeGuides(characters), getActiveSnapshotId()]);
  const attribution = snapshotId ? await getDictionaryAttribution(snapshotId) : [];
  const credit = (source: keyof typeof NAMES) => {
    const row = attribution.find((entry) => entry.source === source);
    return row ? `${NAMES[source]} ${row.version} (${row.license})` : null;
  };
  return { strokeGuides, credits: { jmdict: credit("jmdict"), kanjivg: credit("kanjivg") } };
}
