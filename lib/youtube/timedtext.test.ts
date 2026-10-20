// lib/youtube/timedtext.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimitedLessonCreationProviderError, TransientLessonCreationProviderError } from "@/lib/lesson-creation/errors";
import { fetchJapaneseCaptions, fetchJapaneseCaptionsForWorker, parseCaptionBody, pickJapaneseTrack } from "./timedtext";

const VIDEO_ID = "dQw4w9WgXcQ";
const API_KEY = "AIzaTestKey_123";

const WATCH_HTML = `<html><script>ytcfg.set({"INNERTUBE_API_KEY": "${API_KEY}","X":1});</script></html>`;
const CONSENT_HTML = '<form action="https://consent.youtube.com/s"><input name="v" value="cb.20261019-00-p0"></form>';

const JA_URL = `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=ja&fmt=srv3`;
const JA_ASR_URL = `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=ja&kind=asr`;
const VI_URL = `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=vi`;

function player(captionTracks: unknown[], status = "OK", reason?: string) {
  return {
    playabilityStatus: { status, ...(reason ? { reason } : {}) },
    captions: { playerCaptionsTracklistRenderer: { captionTracks } },
  };
}

const CAPTION_BODY_XML = `<?xml version="1.0" encoding="utf-8" ?><transcript>
<text start="0.5" dur="2.0">こんにちは</text>
<text start="2.5" dur="1.5">&amp;元気ですか&lt;br&gt;</text>
</transcript>`;

interface Routes {
  watch?: () => Response;
  player?: (body: { videoId: string; context: unknown }) => Response;
  body?: (url: URL) => Response;
}

function route(routes: Routes) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    calls.push({ url, init });
    if (url.pathname === "/watch") return (routes.watch ?? (() => new Response(WATCH_HTML)))();
    if (url.pathname === "/youtubei/v1/player") {
      return (routes.player ?? (() => Response.json(player([{ baseUrl: JA_URL, languageCode: "ja" }]))))(
        JSON.parse(String(init?.body)),
      );
    }
    if (url.pathname === "/api/timedtext") return (routes.body ?? (() => new Response(CAPTION_BODY_XML)))(url);
    throw new Error(`unexpected request ${url.href}`);
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJapaneseCaptions", () => {
  it("walks watch page → InnerTube player → caption body and parses the lines", async () => {
    const calls = route({});

    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toEqual([
      { startTime: 0.5, endTime: 2.5, textJp: "こんにちは", textTranslation: null },
      { startTime: 2.5, endTime: 4.0, textJp: "&元気ですか", textTranslation: null },
    ]);
    expect(calls.map((c) => c.url.pathname)).toEqual(["/watch", "/youtubei/v1/player", "/api/timedtext"]);
    expect(calls[1]?.url.searchParams.get("key")).toBe(API_KEY);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
      videoId: VIDEO_ID,
    });
    // srv3 is a different XML shape; the plain format is the one parsed here.
    expect(calls[2]?.url.searchParams.has("fmt")).toBe(false);
  });

  it("prefers the creator's Japanese track over the auto-generated one", async () => {
    const calls = route({
      player: () => Response.json(player([
        { baseUrl: JA_ASR_URL, languageCode: "ja", kind: "asr" },
        { baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en`, languageCode: "en" },
        { baseUrl: JA_URL, languageCode: "ja" },
      ])),
    });
    await fetchJapaneseCaptions(VIDEO_ID);
    expect(calls[2]?.url.searchParams.get("kind")).toBeNull();
  });

  it("falls back to the auto-generated Japanese track", async () => {
    const calls = route({ player: () => Response.json(player([{ baseUrl: JA_ASR_URL, languageCode: "ja", kind: "asr" }])) });
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toHaveLength(2);
    expect(calls[2]?.url.searchParams.get("kind")).toBe("asr");
  });

  it("attaches the creator's Vietnamese track to the Japanese lines it overlaps", async () => {
    const calls = route({
      player: () => Response.json(player([
        { baseUrl: JA_URL, languageCode: "ja" },
        { baseUrl: `${VI_URL}&kind=asr`, languageCode: "vi", kind: "asr" },
        { baseUrl: VI_URL, languageCode: "vi" },
      ])),
      body: (url) => new Response(url.searchParams.get("lang") === "vi"
        ? '<transcript><text start="0.5" dur="2.0">Xin chào</text></transcript>'
        : CAPTION_BODY_XML),
    });
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toEqual([
      { startTime: 0.5, endTime: 2.5, textJp: "こんにちは", textTranslation: "Xin chào" },
      { startTime: 2.5, endTime: 4.0, textJp: "&元気ですか", textTranslation: null },
    ]);
    expect(calls.map((c) => c.url.searchParams.get("lang"))).toEqual([null, null, "ja", "vi"]);
    expect(calls[3]?.url.searchParams.get("kind")).toBeNull();
  });

  it.each([
    ["HTTP 429", () => new Response("", { status: 429 })],
    ["an empty body", () => new Response("<transcript></transcript>")],
  ])("keeps the Japanese lines when the Vietnamese track fails with %s, even on the worker path", async (_, viRoute) => {
    route({
      player: () => Response.json(player([{ baseUrl: JA_URL, languageCode: "ja" }, { baseUrl: VI_URL, languageCode: "vi" }])),
      body: (url) => url.searchParams.get("lang") === "vi" ? viRoute() : new Response(CAPTION_BODY_XML),
    });
    const lines = await fetchJapaneseCaptionsForWorker(VIDEO_ID);
    expect(lines?.map((line) => line.textTranslation)).toEqual([null, null]);
  });

  it("keeps a numeric entity that is not a scalar value as written instead of losing the lesson", async () => {
    route({
      player: () => Response.json(player([{ baseUrl: JA_URL, languageCode: "ja" }, { baseUrl: VI_URL, languageCode: "vi" }])),
      body: (url) => new Response(url.searchParams.get("lang") === "vi"
        ? '<transcript><text start="0.5" dur="2">Xin &amp;#99999999; &amp;#x110000; &amp;#55296; chào</text></transcript>'
        : CAPTION_BODY_XML),
    });
    const lines = await fetchJapaneseCaptionsForWorker(VIDEO_ID);
    expect(lines?.map((line) => line.textTranslation)).toEqual(["Xin &#99999999; &#x110000; &#55296; chào", null]);
  });

  it.each([
    ["needs a PO token", `${VI_URL}&exp=xpe`],
    ["is off YouTube", "https://evil.example/api/timedtext?lang=vi"],
  ])("never fetches a Vietnamese track that %s, and keeps the Japanese lines", async (_, viUrl) => {
    const calls = route({ player: () => Response.json(player([{ baseUrl: JA_URL, languageCode: "ja" }, { baseUrl: viUrl, languageCode: "vi" }])) });
    await expect(fetchJapaneseCaptionsForWorker(VIDEO_ID)).resolves.toHaveLength(2);
    expect(calls.map((c) => c.url.searchParams.get("lang"))).toEqual([null, null, "ja"]);
  });

  it("passes the EU consent page with a CONSENT cookie", async () => {
    let served = 0;
    const calls = route({ watch: () => new Response(served++ === 0 ? CONSENT_HTML : WATCH_HTML) });
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toHaveLength(2);
    expect((calls[1]?.init?.headers as Record<string, string>).Cookie).toBe("CONSENT=YES+cb.20261019-00-p0");
  });

  it.each([
    ["no Japanese track", () => Response.json(player([{ baseUrl: JA_URL.replace("lang=ja", "lang=en"), languageCode: "en" }]))],
    ["no captions at all", () => Response.json({ playabilityStatus: { status: "OK" } })],
    ["an unplayable video", () => Response.json(player([], "ERROR", "This video is unavailable"))],
    ["a track that needs a PO token", () => Response.json(player([{ baseUrl: `${JA_URL}&exp=xpe`, languageCode: "ja" }]))],
    ["a caption URL off YouTube", () => Response.json(player([{ baseUrl: "https://evil.example/api/timedtext", languageCode: "ja" }]))],
    ["a malformed player body", () => new Response("<html>")],
  ])("returns null for %s", async (_, playerRoute) => {
    const calls = route({ player: playerRoute });
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
    expect(calls.some((c) => c.url.pathname === "/api/timedtext" || c.url.hostname === "evil.example")).toBe(false);
  });

  it("returns null when the watch page carries no InnerTube key", async () => {
    route({ watch: () => new Response("<html></html>") });
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it("returns null when the caption body has no <text> entries", async () => {
    route({ body: () => new Response("<transcript></transcript>") });
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it("returns null (never throws) when the network is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });
});

describe("fetchJapaneseCaptionsForWorker", () => {
  it.each([
    ["a captcha page", { watch: () => new Response('<div class="g-recaptcha"></div>') }],
    ["bot detection", { player: () => Response.json(player([], "LOGIN_REQUIRED", "Sign in to confirm you’re not a bot")) }],
    ["HTTP 429 on the player", { player: () => new Response("", { status: 429 }) }],
    ["HTTP 503 on the caption body", { body: () => new Response("", { status: 503 }) }],
  ] as [string, Routes][])("surfaces %s as transient", async (_, routes) => {
    route(routes);
    await expect(fetchJapaneseCaptionsForWorker(VIDEO_ID)).rejects.toBeInstanceOf(TransientLessonCreationProviderError);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it.each([
    ["a captcha page", true, { watch: () => new Response('<div class="g-recaptcha"></div>') }],
    ["bot detection", true, { player: () => Response.json(player([], "LOGIN_REQUIRED", "Sign in to confirm you’re not a bot")) }],
    ["HTTP 429 on the caption body", true, { body: () => new Response("", { status: 429 }) }],
    ["HTTP 503 on the caption body", false, { body: () => new Response("", { status: 503 }) }],
  ] as [string, boolean, Routes][])("classifies %s as rate-limited: %s", async (_, rateLimited, routes) => {
    route(routes);
    const error = await fetchJapaneseCaptionsForWorker(VIDEO_ID).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(TransientLessonCreationProviderError);
    expect(error instanceof RateLimitedLessonCreationProviderError).toBe(rateLimited);
  });

  it("keeps a 404 terminal", async () => {
    route({ body: () => new Response("", { status: 404 }) });
    await expect(fetchJapaneseCaptionsForWorker(VIDEO_ID)).resolves.toBeNull();
  });
});

describe("parseCaptionBody", () => {
  it("decodes double-escaped text, drops markup and blank cues, and tolerates a missing dur", () => {
    expect(parseCaptionBody(
      '<transcript><text dur="1" start="1.25">It&amp;#39;s <font color="#fff">ok</font>\nです</text>'
      + '<text start="3" dur="1">\n</text><text start="4">&#x3042;</text></transcript>',
    )).toEqual([
      { startTime: 1.25, endTime: 2.25, textJp: "It's ok です" },
      { startTime: 4, endTime: 4, textJp: "あ" },
    ]);
  });
});

describe("pickJapaneseTrack", () => {
  it("accepts a regional Japanese code", () => {
    const track = { baseUrl: JA_URL, languageCode: "ja-JP", kind: "manual" as const };
    expect(pickJapaneseTrack([track])).toBe(track);
  });
});
