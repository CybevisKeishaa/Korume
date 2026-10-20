/**
 * Keyless YouTube metadata via the public oEmbed endpoint.
 *
 * No API key involved (approved keyless path — CLAUDE.md §2/§6): we only ask
 * YouTube for title/author/thumbnail, never for video bytes.
 */
import { z } from "zod";
import { RateLimitedLessonCreationProviderError, TransientLessonCreationProviderError } from "@/lib/lesson-creation/errors";
import { sanitizeTranscriptText } from "@/lib/transcript/sanitize";

export interface OembedResult {
  title: string;
  thumbnailUrl: string;
  /** Null when YouTube omits it or sends a non-string: the lesson never fails on the channel name. */
  authorName: string | null;
}

/** Thrown for any non-success outcome (network, HTTP status, or bad body). */
export class OembedFetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OembedFetchError";
  }
}

const oembedResponseSchema = z.object({
  title: z.string(),
  author_name: z.unknown().optional(),
  thumbnail_url: z.string(),
});

/**
 * A provider that accepts the connection and then stalls must not stall the
 * lesson-creation worker with it. The worker runs one job per 5s tick behind an
 * overlap guard, so a hung request freezes claiming AND lease recovery for the
 * whole instance until undici's ~300s default fires — long enough for the 120s
 * lease to expire, which burns the attempt when the pass finally unwinds. Three
 * of those permanently fail a learner's lesson.
 */
const PROVIDER_TIMEOUT_MS = 10_000;

function oembedUrlFor(videoId: string): string {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
}

/** Fetch title/author/thumbnail for a video ID. Throws `OembedFetchError` on failure. */
export async function fetchOembed(videoId: string): Promise<OembedResult> {
  let response: Response;
  try {
    response = await fetch(oembedUrlFor(videoId), { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (err) {
    // Only a transport failure reaches here — `fetch` rejects on a network
    // error or an abort, never on an HTTP status. The worker retries only this
    // type (`worker.ts` `isExplicitlyTransient`), so classifying a stall as
    // `OembedFetchError` would end the lesson as `metadata_unavailable` on the
    // first blip: a verdict on the video, from a fact about the network. The
    // 10s timeout above is what makes that reachable, so the two belong
    // together. `timedtext.ts` classifies its transport the same way.
    throw new TransientLessonCreationProviderError(
      `Network error fetching YouTube oEmbed metadata: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  // A 429 says nothing about the video: retried later, never `metadata_unavailable`.
  if (response.status === 429) {
    throw new RateLimitedLessonCreationProviderError("YouTube oEmbed returned HTTP 429.");
  }
  if (!response.ok) {
    throw new OembedFetchError(
      `YouTube oEmbed request failed with status ${response.status}`,
      response.status,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OembedFetchError("YouTube oEmbed response was not valid JSON", response.status);
  }

  const parsed = oembedResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new OembedFetchError(
      "YouTube oEmbed response did not match the expected shape",
      response.status,
    );
  }

  return {
    title: parsed.data.title,
    thumbnailUrl: parsed.data.thumbnail_url,
    authorName: typeof parsed.data.author_name === "string" ? parsed.data.author_name : null,
  };
}

export interface LessonMetadata {
  title: string;
  thumbnailUrl: string;
  channelTitle: string | null;
}

/**
 * The one bar oEmbed metadata must clear before it becomes a lesson row, for the
 * lesson-creation worker and the admin subtitle import alike: a title that is
 * not blank once sanitized, and an https thumbnail (it is rendered as an
 * `<img src>`). `null` when either fails. The channel name never fails a lesson;
 * it is cut to 200 code points, as `finalize_lesson_creation_job` does, so a
 * surrogate pair is never split.
 */
export function lessonMetadata(oembed: OembedResult): LessonMetadata | null {
  const title = sanitizeTranscriptText(oembed.title);
  if (title.length === 0) return null;
  let thumbnail: URL;
  try {
    thumbnail = new URL(oembed.thumbnailUrl);
  } catch {
    return null;
  }
  if (thumbnail.protocol !== "https:") return null;
  const authorName = oembed.authorName?.trim() ?? "";
  return {
    title,
    thumbnailUrl: oembed.thumbnailUrl,
    channelTitle: authorName.length > 0 ? Array.from(authorName).slice(0, 200).join("") : null,
  };
}
