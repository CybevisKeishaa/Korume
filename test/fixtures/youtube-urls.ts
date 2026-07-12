/**
 * YouTube URL fixtures for `lib/youtube`'s `parseVideoId`.
 *
 * `expectedVideoId: null` marks inputs `parseVideoId` returns null for.
 * Covers watch?v=, youtu.be/, shorts/, embed/, legacy /v/, bare id,
 * with-timestamp, mobile host, and invalid cases — cross-checked against the
 * real parser in `youtube-urls.test.ts`.
 */

export interface YouTubeUrlFixture {
  url: string;
  /** The 11-char video id a correct parser must extract, or null if `url` is invalid. */
  expectedVideoId: string | null;
}

// Rick Astley's "Never Gonna Give You Up" — a stable, well-known 11-char id.
const SAMPLE_ID = "dQw4w9WgXcQ";

export const YOUTUBE_URL_FIXTURES: YouTubeUrlFixture[] = [
  { url: `https://www.youtube.com/watch?v=${SAMPLE_ID}`, expectedVideoId: SAMPLE_ID },
  { url: `https://youtube.com/watch?v=${SAMPLE_ID}`, expectedVideoId: SAMPLE_ID },
  { url: `http://www.youtube.com/watch?v=${SAMPLE_ID}&list=PL123`, expectedVideoId: SAMPLE_ID },
  { url: `https://www.youtube.com/watch?v=${SAMPLE_ID}&t=90s`, expectedVideoId: SAMPLE_ID },
  { url: `https://m.youtube.com/watch?v=${SAMPLE_ID}`, expectedVideoId: SAMPLE_ID },
  { url: `https://youtu.be/${SAMPLE_ID}`, expectedVideoId: SAMPLE_ID },
  { url: `https://youtu.be/${SAMPLE_ID}?t=42`, expectedVideoId: SAMPLE_ID },
  { url: `https://www.youtube.com/shorts/${SAMPLE_ID}`, expectedVideoId: SAMPLE_ID },
  { url: `https://www.youtube.com/embed/${SAMPLE_ID}`, expectedVideoId: SAMPLE_ID },
  { url: `https://www.youtube.com/v/${SAMPLE_ID}`, expectedVideoId: SAMPLE_ID }, // legacy /v/ form
  { url: SAMPLE_ID, expectedVideoId: SAMPLE_ID }, // bare id (no URL) is accepted
  { url: `https://example.com/watch?v=${SAMPLE_ID}`, expectedVideoId: null }, // wrong host
  { url: "not a url at all", expectedVideoId: null },
  { url: "https://www.youtube.com/watch?v=short", expectedVideoId: null }, // id too short
  { url: "https://www.youtube.com/watch", expectedVideoId: null }, // missing v=
  { url: "", expectedVideoId: null },
];
