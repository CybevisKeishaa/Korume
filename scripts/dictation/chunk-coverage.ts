/**
 * Spec §5.2 coverage gate: how many local transcript lines the current chunker can cut into a Word Bank.
 * STRICTLY READ-ONLY: one paged SELECT of transcript_lines.text_jp; nothing is written.
 *
 *   npx vite-node --config vitest.config.ts scripts/dictation/chunk-coverage.ts
 */
import { writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chunkDisplays, displayMap } from "../../lib/dictation/display";
import { normalizeJa } from "../../lib/dictation/normalize";
import { CHUNKERS, currentCut, cutKind, type ChunkReason } from "../../lib/dictation/chunk";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const texts: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("transcript_lines")
      .select("text_jp")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    texts.push(...data.map((r) => r.text_jp as string));
    if (data.length < 1000) break;
  }

  // CHUNKER=<n> runs one version; the default is the resolved cut a learner gets (word cut, else character cut).
  const only = process.env.CHUNKER ? Number(process.env.CHUNKER) : null;
  const chunk = only === null ? currentCut : CHUNKERS[only];
  if (!chunk) throw new Error(`no chunker ${only}`);
  const kinds = new Map<string, number>();
  const subsets = { latin: /[A-Za-zＡ-Ｚａ-ｚ]/, digit: /[0-9０-９]/ };
  const subset = { latin: { total: 0, usable: 0 }, digit: { total: 0, usable: 0 } };
  const fallback = new Map<ChunkReason, string[]>();
  const histogram = new Map<number, number>();
  let usable = 0;
  const nullMaps: string[] = [];
  const dump: { text: string; reliable: boolean; reason: string | null; chunks: string[] }[] = [];
  for (const text of texts) {
    const r = await chunk(text);
    const map = displayMap(text);
    if (map === null) nullMaps.push(text);
    // the displays of a reliable line's chunks must rebuild the raw text minus whitespace
    else if (r.reliable && chunkDisplays(map, normalizeJa(text), r.chunks).join("") !== text.replace(/\s+/g, "")) {
      throw new Error(`display does not rebuild text_jp: ${text}`);
    }
    if (r.reliable) kinds.set(cutKind(r.version), (kinds.get(cutKind(r.version)) ?? 0) + 1);
    for (const [name, re] of Object.entries(subsets)) {
      if (!re.test(text)) continue;
      subset[name as keyof typeof subset].total++;
      if (r.reliable) subset[name as keyof typeof subset].usable++;
    }
    dump.push({ text, reliable: r.reliable, reason: r.reason, chunks: r.chunks });
    if (r.reliable) {
      usable++;
      histogram.set(r.chunks.length, (histogram.get(r.chunks.length) ?? 0) + 1);
    } else {
      fallback.set(r.reason ?? "mismatch", [...(fallback.get(r.reason ?? "mismatch") ?? []), text]);
    }
  }

  const pct = (n: number) => (texts.length ? ((100 * n) / texts.length).toFixed(1) : "0.0") + "%";
  console.log(only === null ? "current cut (word, else character)" : `chunker v${only}`);
  console.log(`total lines: ${texts.length}`);
  console.log(`Word Bank usable: ${usable} (${pct(usable)})`);
  if (only === null) for (const [kind, n] of kinds) console.log(`  usable as ${kind} cut: ${n}`);
  for (const [name, c] of Object.entries(subset)) console.log(`${name} lines: ${c.total}, usable: ${c.usable}`);
  for (const [reason, list] of fallback) {
    console.log(`fallback ${reason}: ${list.length} (${pct(list.length)})`);
    for (const s of list.slice(0, 3)) console.log(`  - ${s}`);
  }
  // COVERAGE_DUMP=<file> writes every line's result so two chunker versions can be diffed.
  if (process.env.COVERAGE_DUMP) writeFileSync(process.env.COVERAGE_DUMP, JSON.stringify(dump));
  console.log(`lines with no display map (shown as normalised): ${nullMaps.length}`);
  for (const s of nullMaps) console.log(`  - ${s}`);
  console.log("chunk-count histogram:");
  for (const [n, count] of [...histogram].sort((a, b) => a[0] - b[0])) console.log(`  ${n} chunks: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
