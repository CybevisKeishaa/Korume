import type { WorkspaceLine } from "./types";

const normalized = (value: string): string => value.normalize("NFC").toLocaleLowerCase();

export function matchingLineIndexes(lines: readonly WorkspaceLine[], query: string): number[] {
  const needle = normalized(query.trim());
  if (needle === "") return lines.map((_, index) => index);
  return lines.flatMap((line, index) => normalized(line.textJp).includes(needle) || normalized(line.textTranslation ?? "").includes(needle) ? [index] : []);
}
