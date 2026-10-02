/**
 * Imports JMdict + KANJIDIC2 + KanjiVG into a new dictionary snapshot and activates it (spec 2026-10-02
 * part 1b §4.1). Source files are never committed.
 *
 *   npm run dict:import -- --jmdict <JMdict_e.gz> --kanjidic <kanjidic2.xml.gz> --kanjivg <kanjivg-*-main.zip>
 *     --jmdict-version … --jmdict-url … --jmdict-license …     (and the same three for kanjidic, kanjivg)
 *     [--allow-remote]
 *
 * Same three file hashes as the active snapshot → prints `no change`, exit 0. On failure the staging
 * snapshot is left for diagnosis and printed, the active snapshot is untouched, exit 1.
 */
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { createGunzip } from "node:zlib";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readJmdict } from "../lib/dictionary/import/jmdict";
import { readKanjidic } from "../lib/dictionary/import/kanjidic";
import { readKanjivgZip } from "../lib/dictionary/import/kanjivg";
import { importDictionaries, type SourceMeta } from "../lib/dictionary/import/stage";

function arg(name: string): string {
  const at = process.argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : process.argv[at + 1];
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function meta(name: string, file: string): Promise<SourceMeta> {
  return { version: arg(`${name}-version`), url: arg(`${name}-url`), license: arg(`${name}-license`), sha256: await sha256(file) };
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url) && !process.argv.includes("--allow-remote")) {
    throw new Error(`refusing a non-local database without --allow-remote: ${url}`);
  }
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const files = { jmdict: arg("jmdict"), kanjidic: arg("kanjidic"), kanjivg: arg("kanjivg") };
  let peakRss = process.memoryUsage().rss;
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 1000);
  const started = Date.now();
  try {
    const result = await importDictionaries(
      client,
      {
        jmdict: { meta: await meta("jmdict", files.jmdict), rows: () => readJmdict(createReadStream(files.jmdict).pipe(createGunzip())) },
        kanjidic: {
          meta: await meta("kanjidic", files.kanjidic),
          rows: () => readKanjidic(createReadStream(files.kanjidic).pipe(createGunzip())),
        },
        kanjivg: { meta: await meta("kanjivg", files.kanjivg), rows: () => readKanjivgZip(files.kanjivg) },
      },
      { log: (line) => console.log(line) },
    );
    if (result.status === "no-change") {
      console.log("no change");
    } else {
      console.log(`activated ${result.snapshotId} ${JSON.stringify(result.counts)}`);
    }
  } finally {
    clearInterval(sampler);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    console.log(`duration ${((Date.now() - started) / 1000).toFixed(1)} s, peak rss ${(peakRss / 1048576).toFixed(0)} MB`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
