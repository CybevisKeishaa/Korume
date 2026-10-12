/**
 * Applies the authored curriculum to a database. Do not run this against a fixture database:
 * sync is authoritative and replaces the local `supabase/seed.sql` curriculum memberships.
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { JLPT_CURRICULUM } from "@/content/curriculum/jlpt";
import { CURRICULUM_LEVELS, validateCurriculumManifest } from "@/lib/curriculum/manifest";

type CurriculumSyncRow = { level: string; members: number };

async function main(): Promise<void> {
  const errors = validateCurriculumManifest(JLPT_CURRICULUM);
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }

  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const youtubeIds = CURRICULUM_LEVELS.flatMap((level) => JLPT_CURRICULUM[level]);
  const { data, error } = youtubeIds.length === 0
    ? { data: [], error: null }
    : await admin.from("videos").select("id, youtube_video_id").in("youtube_video_id", youtubeIds);
  if (error) throw error;

  const idByYoutubeId = new Map((data ?? []).map((row) => [row.youtube_video_id, row.id]));
  const missing = youtubeIds.filter((youtubeId) => !idByYoutubeId.has(youtubeId));
  if (missing.length > 0) {
    console.error(`missing youtube_video_id: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const manifest = Object.fromEntries(CURRICULUM_LEVELS.map((level) => [
    level,
    JLPT_CURRICULUM[level].map((youtubeId) => idByYoutubeId.get(youtubeId)),
  ]));
  const { data: synced, error: syncError } = await admin.rpc("sync_curriculum_manifest", { p_manifest: manifest });
  if (syncError) throw syncError;

  const membersByLevel = new Map((synced as CurriculumSyncRow[] | null ?? []).map((row) => [row.level, row.members]));
  console.log(CURRICULUM_LEVELS.map((level) => `${level} ${membersByLevel.get(level) ?? 0}`).join(" · "));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
