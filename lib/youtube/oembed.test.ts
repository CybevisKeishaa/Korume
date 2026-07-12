import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOembed, OembedFetchError } from "./oembed";

const ID = "dQw4w9WgXcQ";

function mockFetchOnce(response: Partial<Response> & { ok: boolean; status: number }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      json: response.json ?? (async () => ({})),
    } as Response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOembed — success", () => {
  it("fetches and maps the oEmbed response to our shape", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        title: "テスト動画",
        author_name: "Test Channel",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        html: "<iframe ...></iframe>",
      }),
    });

    const result = await fetchOembed(ID);

    expect(result).toEqual({
      title: "テスト動画",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      authorName: "Test Channel",
    });
  });

  it("calls the keyless oEmbed endpoint with the correct video URL, no API key", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        title: "t",
        author_name: "a",
        thumbnail_url: "u",
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    await fetchOembed(ID);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("https://www.youtube.com/oembed?url=");
    expect(calledUrl).toContain(encodeURIComponent(`https://www.youtube.com/watch?v=${ID}`));
    expect(calledUrl).toContain("format=json");
    expect(calledUrl).not.toContain("key=");
  });
});

describe("fetchOembed — failure", () => {
  it("throws OembedFetchError on a non-200 status", async () => {
    mockFetchOnce({ ok: false, status: 404 });
    await expect(fetchOembed(ID)).rejects.toThrow(OembedFetchError);
    await expect(fetchOembed(ID)).rejects.toMatchObject({ status: 404 });
  });

  it("throws OembedFetchError when the body doesn't match the expected shape", async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ unexpected: true }) });
    await expect(fetchOembed(ID)).rejects.toThrow(OembedFetchError);
  });

  it("throws OembedFetchError when the response body isn't valid JSON", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    await expect(fetchOembed(ID)).rejects.toThrow(OembedFetchError);
  });

  it("throws OembedFetchError on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(fetchOembed(ID)).rejects.toThrow(OembedFetchError);
  });
});
