/**
 * YouTube video-ID parsing.
 *
 * Accepts every URL shape users are likely to paste (watch, youtu.be short
 * links, Shorts, embeds) plus a bare 11-char ID, and rejects everything else.
 * Metadata-only per CLAUDE.md §2 — this module never touches video bytes.
 */

/** Canonical shape of a YouTube video ID. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isValidId(id: string): boolean {
  return VIDEO_ID_RE.test(id);
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
}

/** First non-empty path segment, e.g. "/shorts/abc" -> ["shorts", "abc"]. */
function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}

/**
 * Extract an 11-character YouTube video ID from a URL (any common form) or a
 * bare ID. Returns `null` when the input cannot be resolved to a valid ID.
 */
export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Bare ID, e.g. "dQw4w9WgXcQ".
  if (isValidId(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }

  const host = normalizeHost(url.hostname);
  if (host !== "youtube.com" && host !== "youtu.be") {
    return null;
  }

  if (host === "youtu.be") {
    const [id] = pathSegments(url.pathname);
    return id && isValidId(id) ? id : null;
  }

  // host === "youtube.com"
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return id && isValidId(id) ? id : null;
  }

  const [kind, id] = pathSegments(url.pathname);
  if ((kind === "shorts" || kind === "embed" || kind === "v") && id && isValidId(id)) {
    return id;
  }

  return null;
}
