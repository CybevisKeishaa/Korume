/**
 * Deletes retired dictionary snapshots beyond the newest `--keep` (default 1) and their rows.
 *
 *   npm run dict:gc -- [--keep 1] [--allow-remote]
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url) && !process.argv.includes("--allow-remote")) {
    throw new Error(`refusing a non-local database without --allow-remote: ${url}`);
  }
  const at = process.argv.indexOf("--keep");
  const keep = at === -1 ? 1 : Number(process.argv[at + 1]);
  if (!Number.isInteger(keep) || keep < 0) throw new Error("--keep must be a non-negative integer");

  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("dict_gc_snapshots", { p_keep: keep });
  if (error) throw new Error(error.message);
  console.log(`deleted ${data} retired snapshot(s)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
