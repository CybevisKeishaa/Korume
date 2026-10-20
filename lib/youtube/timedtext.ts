// lib/youtube/timedtext.ts
import { TransientLessonCreationProviderError } from "@/lib/lesson-creation/errors";
import { alignTranslations } from "@/lib/transcript/align";

/**
 * Best-effort YouTube caption fetch, the same keyless route the
 * `youtube-transcript-api` Python package takes (v1.2): read the watch page for
 * the public InnerTube key, ask the InnerTube `player` endpoint for the video's
 * caption tracks, then download the chosen track's XML from its `baseUrl`.
 *
 * The old `video.google.com/timedtext?type=list` listing this file used to call
 * stopped returning tracks, so every lesson fell to "no transcript".
 *
 * When the creator also uploaded a Vietnamese track, its cues become each line's
 * translation. YouTube's own auto-translation (`&tlang=vi`) is not an option: it
 * answers 429 to every keyless client, including this one (probed 2026-10-20).
 *
 * This reads only the caption TEXT track YouTube itself serves publicly — never
 * audio/video bytes — per AGENTS.md rule 1. Never throws on the plain path: any
 * failure (network, missing track, malformed body) resolves to `null`, meaning
 * "no transcript found". The worker path surfaces transient failures instead.
 */

export interface TimedTextLine {
  startTime: number;
  endTime: number;
  textJp: string;
}

export interface CaptionLine extends TimedTextLine {
  textTranslation: string | null;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind: "manual" | "asr";
}

/** See `oembed.ts`: a stalled provider request freezes the whole worker. */
const PROVIDER_TIMEOUT_MS = 10_000;

/** The client `youtube-transcript-api` uses: its player response carries caption URLs without a PO token. */
const INNERTUBE_CONTEXT = { client: { clientName: "ANDROID", clientVersion: "20.10.38" } };

/** Caption bodies are fetched only from YouTube itself: `baseUrl` comes from a response, not from us. */
const CAPTION_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);

type Stage = "watch-page" | "player" | "caption-body";

class CaptionsBlocked extends Error {}

function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function playerUrl(apiKey: string): string {
  return `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`;
}

/**
 * A numeric entity that is not a scalar value stays as written: past U+10FFFF
 * `String.fromCodePoint` throws, and a lone surrogate (U+D800–DFFF) is refused
 * by Postgres once the lines reach finalize as JSON.
 */
function codePoint(entity: string, value: number): string {
  return value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff) ? entity : String.fromCodePoint(value);
}

/** Decodes named entities YouTube emits plus numeric ones (`&#39;`, `&#x27;`). */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex: string) => codePoint(entity, Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (entity, dec: string) => codePoint(entity, Number.parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attribute(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return match ? (match[1] as string) : null;
}

/**
 * Parses `<text start="…" dur="…">…</text>` entries into timed lines. The body is
 * XML whose text is itself HTML-escaped (`&amp;#39;`), so it is decoded twice and
 * any markup (`<font>`, `<br>`) is dropped — as the Python package does.
 */
export function parseCaptionBody(xml: string): TimedTextLine[] {
  const lines: TimedTextLine[] = [];
  const textRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = textRe.exec(xml)) !== null) {
    const attrs = match[1] as string;
    const start = Number.parseFloat(attribute(attrs, "start") ?? "");
    const dur = Number.parseFloat(attribute(attrs, "dur") ?? "0");
    if (!Number.isFinite(start) || !Number.isFinite(dur)) continue;
    const text = decodeEntities(decodeEntities(match[2] as string))
      .replace(/<[^>]*>/g, "")
      .replace(/\s*\n\s*/g, " ")
      .trim();
    if (text.length === 0) continue;
    lines.push({ startTime: start, endTime: start + dur, textJp: text });
  }
  return lines;
}

/** Reads the caption tracks out of an InnerTube `player` response; `null` when the video is not playable. */
function captionTracks(player: unknown): CaptionTrack[] | null {
  const data = player as {
    playabilityStatus?: { status?: string; reason?: string };
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: unknown } };
  } | null;
  const status = data?.playabilityStatus?.status;
  if (status !== undefined && status !== "OK") {
    // "Sign in to confirm you're not a bot": YouTube is refusing this IP for now, not this video for good.
    if (status === "LOGIN_REQUIRED" && /bot/i.test(data?.playabilityStatus?.reason ?? "")) throw new CaptionsBlocked();
    return null;
  }
  const raw = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(raw)) return [];
  const tracks: CaptionTrack[] = [];
  for (const entry of raw as { baseUrl?: unknown; languageCode?: unknown; kind?: unknown }[]) {
    if (typeof entry?.baseUrl !== "string" || typeof entry.languageCode !== "string") continue;
    tracks.push({ baseUrl: entry.baseUrl, languageCode: entry.languageCode, kind: entry.kind === "asr" ? "asr" : "manual" });
  }
  return tracks;
}

function isJapanese(track: CaptionTrack): boolean {
  return track.languageCode === "ja" || track.languageCode.startsWith("ja-");
}

/** A creator's own Japanese track first; YouTube's auto-generated one only when there is no other. */
export function pickJapaneseTrack(tracks: readonly CaptionTrack[]): CaptionTrack | null {
  return tracks.find((t) => isJapanese(t) && t.kind === "manual") ?? tracks.find((t) => isJapanese(t) && t.kind === "asr") ?? null;
}

/** Only a creator's Vietnamese track: auto-generated Vietnamese speech recognition on a Japanese video is noise. */
function pickVietnameseTrack(tracks: readonly CaptionTrack[]): CaptionTrack | null {
  return tracks.find((t) => t.kind === "manual" && (t.languageCode === "vi" || t.languageCode.startsWith("vi-"))) ?? null;
}

/** The track's XML URL, or `null` when it is not a YouTube URL or needs a PO token we cannot mint. */
function captionBodyUrl(track: CaptionTrack): string | null {
  let url: URL;
  try {
    url = new URL(track.baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !CAPTION_HOSTS.has(url.hostname)) return null;
  if (url.searchParams.get("exp") === "xpe") return null;
  url.searchParams.delete("fmt");
  return url.toString();
}

function isTransientHttpStatus(status: number): boolean {
  return status === 429 || status === 503;
}

async function request(
  url: string,
  init: RequestInit,
  surfaceTransientErrors: boolean,
  stage: Stage,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Accept-Language": "en-US", ...init.headers },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    if (surfaceTransientErrors) {
      throw new TransientLessonCreationProviderError(`YouTube ${stage} transport failed.`, { cause: error });
    }
    return null;
  }
  if (!response.ok) {
    if (surfaceTransientErrors && isTransientHttpStatus(response.status)) {
      throw new TransientLessonCreationProviderError(`YouTube ${stage} returned transient HTTP ${response.status}.`);
    }
    return null;
  }
  try {
    return await response.text();
  } catch (error) {
    if (surfaceTransientErrors) {
      throw new TransientLessonCreationProviderError(`YouTube ${stage} body could not be read.`, { cause: error });
    }
    return null;
  }
}

/** The watch page, past the EU consent interstitial when YouTube serves one. */
async function fetchWatchPage(videoId: string, surfaceTransientErrors: boolean): Promise<string | null> {
  const html = await request(watchUrl(videoId), {}, surfaceTransientErrors, "watch-page");
  if (html === null || !html.includes('action="https://consent.youtube.com/s"')) return html;
  const consent = /name="v" value="([^"]*)"/.exec(html);
  if (!consent) return null;
  const retried = await request(
    watchUrl(videoId),
    { headers: { Cookie: `CONSENT=YES+${consent[1]}` } },
    surfaceTransientErrors,
    "watch-page",
  );
  return retried !== null && retried.includes('action="https://consent.youtube.com/s"') ? null : retried;
}

/** Best-effort on both paths: a missing translation must never cost the lesson its Japanese lines. */
async function fetchTranslations(tracks: readonly CaptionTrack[], lines: readonly TimedTextLine[]): Promise<(string | null)[]> {
  const track = pickVietnameseTrack(tracks);
  const bodyUrl = track === null ? null : captionBodyUrl(track);
  const xml = bodyUrl === null ? null : await request(bodyUrl, {}, false, "caption-body");
  return alignTranslations(lines, xml === null ? [] : parseCaptionBody(xml));
}

async function fetchJapaneseCaptionsInternal(
  videoId: string,
  surfaceTransientErrors: boolean,
): Promise<CaptionLine[] | null> {
  try {
    const html = await fetchWatchPage(videoId, surfaceTransientErrors);
    if (html === null) return null;
    // A captcha page: YouTube is rate-limiting this IP.
    if (html.includes('class="g-recaptcha"')) throw new CaptionsBlocked();
    const apiKey = /"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/.exec(html)?.[1];
    if (!apiKey) return null;

    const playerBody = await request(
      playerUrl(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: INNERTUBE_CONTEXT, videoId }),
      },
      surfaceTransientErrors,
      "player",
    );
    if (playerBody === null) return null;
    let player: unknown;
    try {
      player = JSON.parse(playerBody);
    } catch {
      return null;
    }

    const tracks = captionTracks(player);
    const track = tracks === null ? null : pickJapaneseTrack(tracks);
    const bodyUrl = track === null ? null : captionBodyUrl(track);
    if (bodyUrl === null) return null;

    const xml = await request(bodyUrl, {}, surfaceTransientErrors, "caption-body");
    if (xml === null) return null;
    const lines = parseCaptionBody(xml);
    if (lines.length === 0) return null;
    const translations = await fetchTranslations(tracks ?? [], lines);
    return lines.map((line, index) => ({ ...line, textTranslation: translations[index] ?? null }));
  } catch (error) {
    if (!(error instanceof CaptionsBlocked)) throw error;
    if (surfaceTransientErrors) throw new TransientLessonCreationProviderError("YouTube is rate-limiting caption requests.");
    return null;
  }
}

/** Fetches the Japanese caption track for a YouTube video (with any creator Vietnamese track aligned onto it), or `null` if none exists / any step fails. */
export async function fetchJapaneseCaptions(videoId: string): Promise<CaptionLine[] | null> {
  return fetchJapaneseCaptionsInternal(videoId, false);
}

/** Worker-only caption fetch that preserves transient failures for retry classification. */
export async function fetchJapaneseCaptionsForWorker(videoId: string): Promise<CaptionLine[] | null> {
  return fetchJapaneseCaptionsInternal(videoId, true);
}
