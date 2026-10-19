/**
 * Deterministic YouTube seam for the C4 browser acceptance, loaded into the
 * Next.js server process with `node --require` from the Playwright webServer
 * command ONLY.
 *
 * Why a preload rather than a fixture flag in the app: the lesson-creation
 * worker's provider calls happen server-side, so Playwright's own request
 * interception cannot reach them, and the alternative — an env-switchable
 * base URL for youtube.com — would add a production code path whose whole
 * purpose is testing, and one that lets ambient configuration point "YouTube"
 * at an arbitrary host. This file changes nothing that ships: it patches
 * `globalThis.fetch` in the test's own server process, for two hosts, and
 * passes every other request through untouched.
 *
 * Plan Global Constraint: no real YouTube endpoint is ever called. A request
 * to a YouTube host for an id this file does not know is a hard failure, not
 * a pass-through — a silent escape to the network is exactly what this exists
 * to prevent.
 */

/** A video with Japanese captions: the pipeline should reach a studyable lesson. */
const WITH_CAPTIONS = "e2ecap00001";
/** A video with no caption tracks: a truthful no-caption failure. */
const WITHOUT_CAPTIONS = "e2enocap001";

const TITLES = {
  [WITH_CAPTIONS]: "E2E Job Lesson With Captions",
  [WITHOUT_CAPTIONS]: "E2E Job Lesson Without Captions",
};

const CAPTION_BODY =
  '<?xml version="1.0" encoding="utf-8"?><transcript>' +
  '<text start="0.0" dur="2.5">こんにちは、元気ですか。</text>' +
  '<text start="2.5" dur="3.0">今日はいい天気ですね。</text>' +
  '<text start="5.5" dur="2.0">また明日会いましょう。</text>' +
  "</transcript>";

function xml(body) {
  return new Response(body, { status: 200, headers: { "content-type": "text/xml" } });
}

function json(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function videoIdFrom(url) {
  const direct = url.searchParams.get("v");
  if (direct !== null) return direct;
  const nested = url.searchParams.get("url");
  if (nested === null) return null;
  try {
    return new URL(nested).searchParams.get("v");
  } catch {
    return null;
  }
}

function videoIdFromBody(init) {
  try {
    return JSON.parse(String(init?.body)).videoId ?? null;
  } catch {
    return null;
  }
}

const realFetch = globalThis.fetch;

globalThis.fetch = async function stubbedFetch(input, init) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return realFetch(input, init);
  }

  const isYouTubeHost = url.hostname === "www.youtube.com" || url.hostname === "video.google.com";
  if (!isYouTubeHost) return realFetch(input, init);

  // The InnerTube player call names its video in the JSON body, not the URL.
  const videoId = url.pathname === "/youtubei/v1/player" ? videoIdFromBody(init) : videoIdFrom(url);
  if (videoId === null || TITLES[videoId] === undefined) {
    throw new Error(`[youtube-stub] refusing to reach the network for ${url.href}`);
  }

  if (url.pathname === "/oembed") {
    return json({
      title: TITLES[videoId],
      thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      author_name: "E2E",
      html: "",
    });
  }

  // lib/youtube/timedtext.ts: watch page → InnerTube player → caption track body.
  if (url.pathname === "/watch") {
    return new Response('<script>ytcfg.set({"INNERTUBE_API_KEY":"e2e-stub-key"});</script>', {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }

  if (url.pathname === "/youtubei/v1/player") {
    // No caption tracks at all is the truthful "this video has no captions".
    const captionTracks = videoId === WITHOUT_CAPTIONS
      ? []
      : [{ baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ja`, languageCode: "ja" }];
    return json({ playabilityStatus: { status: "OK" }, captions: { playerCaptionsTracklistRenderer: { captionTracks } } });
  }

  if (url.pathname === "/api/timedtext") {
    return xml(CAPTION_BODY);
  }

  throw new Error(`[youtube-stub] unexpected YouTube path ${url.pathname}`);
};

console.info("[youtube-stub] installed for www.youtube.com and video.google.com");
