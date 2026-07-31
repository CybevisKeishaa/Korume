// lib/youtube/timedtext.ts
/**
 * Best-effort YouTube caption fetch via the unofficial, keyless `timedtext`
 * endpoint (`video.google.com/timedtext`). This reads only the caption TEXT
 * track YouTube itself serves publicly — never audio/video bytes — per
 * CLAUDE.md §2. Never throws: any failure (network, missing track, malformed
 * XML) resolves to `null`, meaning "no transcript found," which Create
 * Lesson (lib/data/lesson-creation.ts) treats as the no-caption branch.
 */

export interface TimedTextLine {
  startTime: number;
  endTime: number;
  textJp: string;
}

interface CaptionTrack {
  langCode: string;
  kind: "manual" | "asr";
}

function trackListUrl(videoId: string): string {
  return `https://video.google.com/timedtext?type=list&v=${encodeURIComponent(videoId)}`;
}

function captionBodyUrl(videoId: string, track: CaptionTrack): string {
  const kindParam = track.kind === "asr" ? "&kind=asr" : "";
  return `https://video.google.com/timedtext?lang=${encodeURIComponent(track.langCode)}${kindParam}&v=${encodeURIComponent(videoId)}`;
}

/** Parses `<track lang_code="ja" kind="asr"?/>` entries out of the type=list response. */
function parseTrackList(xml: string): CaptionTrack[] {
  const tracks: CaptionTrack[] = [];
  const trackRe = /<track\b([^>]*)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = trackRe.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const langMatch = /lang_code="([^"]*)"/.exec(attrs);
    if (!langMatch) continue;
    const kind: "manual" | "asr" = /kind="asr"/.test(attrs) ? "asr" : "manual";
    tracks.push({ langCode: langMatch[1] as string, kind });
  }
  return tracks;
}

/** Decodes the handful of entities YouTube's timedtext XML actually emits. */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Parses `<text start="..." dur="...">...</text>` entries into timed lines. */
function parseCaptionBody(xml: string): TimedTextLine[] {
  const lines: TimedTextLine[] = [];
  const textRe = /<text start="([^"]*)" dur="([^"]*)">([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = textRe.exec(xml)) !== null) {
    const start = Number.parseFloat(match[1] as string);
    const dur = Number.parseFloat(match[2] as string);
    if (Number.isNaN(start) || Number.isNaN(dur)) continue;
    lines.push({ startTime: start, endTime: start + dur, textJp: decodeEntities((match[3] as string).trim()) });
  }
  return lines;
}

function pickJapaneseTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const manual = tracks.find((t) => t.langCode === "ja" && t.kind === "manual");
  if (manual) return manual;
  return tracks.find((t) => t.langCode === "ja" && t.kind === "asr") ?? null;
}

/** Fetches the Japanese caption track for a YouTube video, or `null` if none exists / any step fails. */
export async function fetchJapaneseCaptions(videoId: string): Promise<TimedTextLine[] | null> {
  try {
    const listResponse = await fetch(trackListUrl(videoId));
    if (!listResponse.ok) return null;

    const listXml = await listResponse.text();
    const track = pickJapaneseTrack(parseTrackList(listXml));
    if (!track) return null;

    const bodyResponse = await fetch(captionBodyUrl(videoId, track));
    if (!bodyResponse.ok) return null;

    const bodyXml = await bodyResponse.text();
    const lines = parseCaptionBody(bodyXml);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}
