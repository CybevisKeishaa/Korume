/**
 * Seeds one real lesson from its two SRT files into the LOCAL database — the Ep.729 fixture the live
 * Playwright gate measures against (spec §8 "Ep.729 fixture"). The SRT files are not committed.
 *
 *   npx vite-node --config vitest.config.ts scripts/seed-real-lesson.ts -- --dir <folder with *[ja].srt and *[vi]*.srt or *[ja-vi]*.srt> --youtube <id>
 *
 * (`--config vitest.config.ts` supplies the `@/` alias the imported lib modules use.)
 * The Vietnamese file is aligned onto the Japanese lines by time (lib/transcript/align.ts), so a creator's
 * track split at different points still lands. Idempotent: the video row is kept (so its uuid survives a
 * re-run) and its transcript is replaced. Prints `video <uuid> lines <n> translated <m>`.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { toFurigana } from "../lib/japanese/furigana";
import { parseBilingualTranscript } from "../lib/transcript/align";
import { fetchOembed } from "../lib/youtube/oembed";

function arg(name: string): string {
  const at = process.argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : process.argv[at + 1];
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

const dir = arg("dir");
const youtubeId = arg("youtube");
loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error(`refusing to seed a non-local database: ${url}`);
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const files = readdirSync(dir).filter((file) => file.endsWith(".srt"));
const pick = (test: (file: string) => boolean, label: string) => {
  const matches = files.filter(test);
  if (matches.length !== 1) throw new Error(`expected exactly one ${label} SRT in ${dir}, found ${matches.length}`);
  return readFileSync(path.join(dir, matches[0]!), "utf8");
};
const japanese = parseBilingualTranscript(
  pick((file) => file.includes("[ja]."), "[ja]"),
  pick((file) => file.includes("[vi]") || file.includes("[ja-vi]"), "[vi] or [ja-vi]"),
  "srt",
);
if (japanese.length === 0) throw new Error("the [ja] SRT has no lines");

const oembed = await fetchOembed(youtubeId);
const last = japanese.at(-1)!;
const row = {
  youtube_video_id: youtubeId,
  title: oembed.title,
  channel_title: oembed.authorName,
  duration_seconds: Math.ceil(last.endTime ?? last.startTime),
  thumbnail_url: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
  library_access: "FREE",
};

const existing = await admin.from("videos").select("id").eq("youtube_video_id", youtubeId).maybeSingle();
if (existing.error) throw existing.error;
const saved = existing.data
  ? await admin.from("videos").update(row).eq("id", existing.data.id).select("id").single()
  : await admin.from("videos").insert(row).select("id").single();
if (saved.error) throw saved.error;
const videoId = saved.data.id as string;

// Replace, never append: a second run must leave exactly one transcript (its lines and marks cascade).
const removed = await admin.from("transcripts").delete().eq("video_id", videoId);
if (removed.error) throw removed.error;
const transcript = await admin.from("transcripts").insert({ video_id: videoId, source: "youtube_caption", language: "ja" }).select("id").single();
if (transcript.error) throw transcript.error;

const lines = [];
for (const line of japanese) {
  lines.push({
    transcript_id: transcript.data.id,
    start_time: line.startTime,
    end_time: line.endTime,
    text_jp: line.textJp,
    text_translation: line.textTranslation ?? null,
    furigana_json: await toFurigana(line.textJp),
  });
}
const inserted = await admin.from("transcript_lines").insert(lines);
if (inserted.error) throw inserted.error;
console.log(`video ${videoId} lines ${lines.length} translated ${lines.filter((line) => line.text_translation !== null).length}`);
