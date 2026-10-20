import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { SrtImportForm } from "./srt-import-form";

const JA = "1\n00:00:01,000 --> 00:00:04,000\nこんにちは\n";
const VI = "1\n00:00:01,000 --> 00:00:04,000\nXin chào\n";

/** jsdom's File has no `text()`, which every browser this form targets does. */
function subtitle(content: string, name: string): File {
  const file = new File([content], name);
  Object.defineProperty(file, "text", { value: async () => content });
  return file;
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body } as Response;
}

async function fill(files: { ja: File; vi?: File }) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("YouTube link or video ID"), "kIDaXEnkjmk");
  await user.upload(screen.getByLabelText("Japanese subtitles (.srt / .vtt)"), files.ja);
  if (files.vi) await user.upload(screen.getByLabelText("Vietnamese subtitles (optional)"), files.vi);
  await user.selectOptions(screen.getByLabelText("Tier"), "PLUS");
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SrtImportForm", () => {
  it("sends both files' text with the Japanese file's format and reports the created lesson", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { data: { videoId: "v1", created: true, lineCount: 1, translatedCount: 1 } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SrtImportForm />);

    const user = await fill({ ja: subtitle(JA, "ep [ja].vtt"), vi: subtitle(VI, "ep [vi].vtt") });
    await user.click(screen.getByRole("button", { name: "Import lesson" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Lesson created: 1 lines, 1 with a translation."));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/videos/import-srt", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      youtubeUrl: "kIDaXEnkjmk",
      libraryAccess: "PLUS",
      format: "vtt",
      content: JA,
      translation: VI,
    });
  });

  it("omits the translation when no Vietnamese file is chosen, and shows the server's reason on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, { error: "Could not read this video's title and thumbnail from YouTube" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SrtImportForm />);

    const user = await fill({ ja: subtitle(JA, "ep [ja].srt") });
    await user.click(screen.getByRole("button", { name: "Import lesson" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not read this video's title and thumbnail from YouTube"));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body.format).toBe("srt");
    expect(body).not.toHaveProperty("translation");
  });

  it("asks before replacing an existing lesson, then resends with `replace`", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(409, { error: "exists", exists: true }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { videoId: "v1", created: false, lineCount: 1, translatedCount: 0 } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SrtImportForm />);

    const user = await fill({ ja: subtitle(JA, "ep [ja].srt") });
    await user.click(screen.getByRole("button", { name: "Import lesson" }));
    expect(await screen.findByRole("dialog", { name: "Replace this video's transcript?" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Replace transcript" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("its transcript was replaced: 1 lines"));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty("replace");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({ replace: true });
  });

  it("cancelling the replace sends nothing more", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, { error: "exists", exists: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SrtImportForm />);

    const user = await fill({ ja: subtitle(JA, "ep [ja].srt") });
    await user.click(screen.getByRole("button", { name: "Import lesson" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says why it cannot import without a Japanese file", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SrtImportForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("YouTube link or video ID"), "kIDaXEnkjmk");
    await user.click(screen.getByRole("button", { name: "Import lesson" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose the Japanese subtitle file.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
