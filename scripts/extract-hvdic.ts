/**
 * Rebuilds `lib/dictionary/import/hvdic-pho-thong.json` from a KanjiDictVN `hvcache/` directory (one saved
 * hvdic.thivien.net page per character, file name = the percent-encoded character), owner ruling K16.
 *
 *   npx vite-node --config vitest.config.ts scripts/extract-hvdic.ts -- <hvcache dir> <commit sha>
 *
 * The pages are untrusted third-party HTML: only read as text, never executed.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseHvdicPage, type HvdicIndex } from "../lib/dictionary/import/hvdic";

async function main(): Promise<void> {
  const [dir, sha] = process.argv.slice(2).filter((arg) => arg !== "--");
  if (!dir || !sha) throw new Error("usage: extract-hvdic.ts -- <hvcache dir> <commit sha>");
  const entries: HvdicIndex = {};
  for (const file of (await readdir(dir)).sort()) {
    const blocks = parseHvdicPage(await readFile(join(dir, file), "utf8"));
    if (blocks.length > 0) entries[decodeURIComponent(file)] = blocks;
  }
  const out = join(process.cwd(), "lib/dictionary/import/hvdic-pho-thong.json");
  const _source = `github.com/trungnt2910/KanjiDictVN hvcache @ ${sha.slice(0, 8)}, hvdic.thivien.net 'Từ điển phổ thông'`;
  await writeFile(out, `${JSON.stringify({ _source, entries }, null, 1)}\n`);
  console.log(`${Object.keys(entries).length} characters → ${out}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
