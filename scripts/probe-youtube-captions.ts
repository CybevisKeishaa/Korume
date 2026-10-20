/**
 * Fetches a video's Japanese captions through the same code the lesson-creation worker uses
 * (lib/youtube/timedtext.ts) and prints them as SRT, a creator Vietnamese line under its Japanese one —
 * a live check that needs no database.
 *
 *   npx vite-node --config vitest.config.ts scripts/probe-youtube-captions.ts -- <youtube id or url> [> out.srt]
 *
 * The line count goes to stderr, so redirecting stdout leaves a clean .srt file.
 */
import { fetchJapaneseCaptionsForWorker } from "../lib/youtube/timedtext";
import { parseVideoId } from "../lib/youtube/video-id";

function srtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

const input = process.argv.slice(2).find((arg) => arg !== "--");
const videoId = input ? parseVideoId(input) : null;
if (!videoId) {
  console.error("usage: scripts/probe-youtube-captions.ts -- <youtube id or url>");
  process.exit(2);
}

const lines = await fetchJapaneseCaptionsForWorker(videoId);
if (!lines) {
  console.error(`${videoId}: no Japanese caption track`);
  process.exit(1);
}
process.stdout.write(lines.map((line, index) =>
  `${index + 1}\n${srtTime(line.startTime)} --> ${srtTime(line.endTime)}\n${line.textJp}\n${line.textTranslation === null ? "" : `${line.textTranslation}\n`}`).join("\n"));
console.error(`${videoId}: ${lines.length} lines, ${lines.filter((line) => line.textTranslation !== null).length} with Vietnamese`);
