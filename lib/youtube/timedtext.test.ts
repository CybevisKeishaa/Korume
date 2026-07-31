// lib/youtube/timedtext.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJapaneseCaptions } from "./timedtext";

const VIDEO_ID = "dQw4w9WgXcQ";

const TRACK_LIST_XML = `<?xml version="1.0" encoding="utf-8" ?><transcript_list docid="123">
  <track id="0" name="" lang_code="en" lang_original="English" lang_translated="English" lang_default="true"/>
  <track id="1" name="" lang_code="ja" lang_original="日本語" lang_translated="Japanese" lang_default="false"/>
</transcript_list>`;

const TRACK_LIST_XML_NO_JA = `<?xml version="1.0" encoding="utf-8" ?><transcript_list docid="123">
  <track id="0" name="" lang_code="en" lang_original="English" lang_translated="English" lang_default="true"/>
</transcript_list>`;

const CAPTION_BODY_XML = `<?xml version="1.0" encoding="utf-8" ?><transcript>
<text start="0.5" dur="2.0">こんにちは</text>
<text start="2.5" dur="1.5">&amp;元気ですか&lt;br&gt;</text>
</transcript>`;

function mockFetchSequence(responses: { ok: boolean; text: string }[]) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({ ok: r.ok, text: async () => r.text } as Response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJapaneseCaptions", () => {
  it("returns parsed lines when a ja track exists", async () => {
    mockFetchSequence([
      { ok: true, text: TRACK_LIST_XML },
      { ok: true, text: CAPTION_BODY_XML },
    ]);

    const lines = await fetchJapaneseCaptions(VIDEO_ID);

    expect(lines).toEqual([
      { startTime: 0.5, endTime: 2.5, textJp: "こんにちは" },
      { startTime: 2.5, endTime: 4.0, textJp: "&元気ですか<br>" },
    ]);
  });

  it("returns null when no ja track is listed", async () => {
    mockFetchSequence([{ ok: true, text: TRACK_LIST_XML_NO_JA }]);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it("returns null (never throws) when the track-list request fails", async () => {
    mockFetchSequence([{ ok: false, text: "" }]);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it("returns null (never throws) when the track-list fetch itself rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it("returns null when the caption body has no <text> entries", async () => {
    mockFetchSequence([
      { ok: true, text: TRACK_LIST_XML },
      { ok: true, text: "<transcript></transcript>" },
    ]);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });
});
