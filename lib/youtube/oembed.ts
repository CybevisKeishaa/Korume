/**
 * Keyless YouTube metadata via the public oEmbed endpoint.
 *
 * No API key involved (approved keyless path — CLAUDE.md §2/§6): we only ask
 * YouTube for title/author/thumbnail, never for video bytes.
 */
import { z } from "zod";

export interface OembedResult {
  title: string;
  thumbnailUrl: string;
  authorName: string;
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
  author_name: z.string(),
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
    throw new OembedFetchError(
      `Network error fetching YouTube oEmbed metadata: ${err instanceof Error ? err.message : String(err)}`,
    );
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
    authorName: parsed.data.author_name,
  };
}
