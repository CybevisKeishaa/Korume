import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type TcCategory = "direct" | "kyujitai" | "redirect-resolved" | "redirect-unresolved" | "none";
export type TcResolution = { lines: string[]; category: TcCategory; reason: null | "missing-target" | "chained" };

const REDIRECT = /^(?:Giản thể|Dị dạng|Một dạng|Một cách viết|Một dị dạng) của chữ \[?(\p{Script=Han})\]?\.?$/u;

/** Reads the 64 shards (`<xx>.json`, key = hex code point); keeps only the `tc` field. */
export async function loadThieuChuu(dir: string): Promise<Map<string, string[]>> {
  const index = new Map<string, string[]>();
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".json"))) {
    const shard = JSON.parse(await readFile(join(dir, file), "utf8")) as Record<string, { tc?: string[] }>;
    for (const [key, entry] of Object.entries(shard)) {
      if (entry.tc?.length) index.set(String.fromCodePoint(parseInt(key, 16)), entry.tc);
    }
  }
  return index;
}

/** One redirect hop at most; a redirect whose target is itself a redirect stays unresolved. */
export function resolveTcLines(literal: string, index: Map<string, string[]>, oldForms: Record<string, string[]>): TcResolution {
  let lines = index.get(literal);
  let category: "direct" | "kyujitai" = "direct";
  if (!lines) {
    const form = (oldForms[literal] ?? []).find((old) => index.has(old));
    lines = form ? index.get(form) : undefined;
    category = "kyujitai";
  }
  if (!lines) return { lines: [], category: "none", reason: null };
  const target = REDIRECT.exec(lines[0] ?? "")?.[1];
  if (!target) return { lines, category, reason: null };
  const targetLines = index.get(target);
  if (!targetLines) return { lines, category: "redirect-unresolved", reason: "missing-target" };
  if (REDIRECT.test(targetLines[0] ?? "")) return { lines, category: "redirect-unresolved", reason: "chained" };
  const rest = lines.slice(1).filter((line) => !targetLines.includes(line));
  return { lines: [...targetLines, ...rest], category: "redirect-resolved", reason: null };
}
