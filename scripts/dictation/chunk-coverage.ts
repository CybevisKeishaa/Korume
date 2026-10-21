/**
 * Spec §5.2 coverage gate: how many local transcript lines the current chunker can cut into a Word Bank.
 * STRICTLY READ-ONLY: one paged SELECT of transcript_lines.text_jp; nothing is written.
 *
 *   npx vite-node --config vitest.config.ts scripts/dictation/chunk-coverage.ts
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { CHUNKERS, CURRENT_CHUNKER, type ChunkReason } from "../../lib/dictation/chunk";

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

  const chunk = CHUNKERS[CURRENT_CHUNKER];
  if (!chunk) throw new Error("no current chunker");
  const fallback = new Map<ChunkReason, string[]>();
  const histogram = new Map<number, number>();
  let usable = 0;
  for (const text of texts) {
    const r = await chunk(text);
    if (r.reliable) {
      usable++;
      histogram.set(r.chunks.length, (histogram.get(r.chunks.length) ?? 0) + 1);
    } else {
      fallback.set(r.reason!, [...(fallback.get(r.reason!) ?? []), text]);
    }
  }

  const pct = (n: number) => (texts.length ? ((100 * n) / texts.length).toFixed(1) : "0.0") + "%";
  console.log(`chunker v${CURRENT_CHUNKER}`);
  console.log(`total lines: ${texts.length}`);
  console.log(`Word Bank usable: ${usable} (${pct(usable)})`);
  for (const [reason, list] of fallback) {
    console.log(`fallback ${reason}: ${list.length} (${pct(list.length)})`);
    for (const s of list.slice(0, 3)) console.log(`  - ${s}`);
  }
  console.log("chunk-count histogram:");
  for (const [n, count] of [...histogram].sort((a, b) => a[0] - b[0])) console.log(`  ${n} chunks: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
