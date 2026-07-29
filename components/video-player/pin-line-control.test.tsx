import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import type { TranscriptLineRow } from "@/lib/video-types";
import { PinLineControl } from "./pin-line-control";

const line: TranscriptLineRow = {
  id: "l1",
  start_time: 12.5,
  end_time: 15,
  text_jp: "逃げるは恥だが役に立つ",
  text_translation: null,
  furigana_json: null,
};

describe("PinLineControl", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // A failing assertion inside a test body would skip an inline
    // `spy.mockRestore()`, leaving console.error mocked for the rest of the
    // file — restore unconditionally here instead (mirrors
    // mining-review-session.test.tsx).
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = undefined;
  });

  it("opens the dialog and POSTs the pin with pointers + note", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PinLineControl line={line} videoId="v1" />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.type(screen.getByLabelText(/a few words/i), "chills");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companion/memories",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          transcriptLineId: "l1",
          videoId: "v1",
          lineTextJp: "逃げるは恥だが役に立つ",
          timestampSeconds: 12.5,
          note: "chills",
        }),
      }),
    );
    expect(await screen.findByText(/it's in your journal now/i)).toBeInTheDocument();
  });

  it("shows the translated network error on fetch failure — no raw diagnostics (convention #4)", async () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const user = userEvent.setup();
    render(<PinLineControl line={line} />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
    expect(screen.queryByText(/ECONNRESET/)).toBeNull();
    // The diagnostic goes to the developer console, never to the DOM.
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("maps 429 to the gentle too-fast message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );
    const user = userEvent.setup();
    render(<PinLineControl line={line} />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/take a breath/i)).toBeInTheDocument();
  });

  it("maps 401 to the signed-out message, not the generic network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );
    const user = userEvent.setup();
    render(<PinLineControl line={line} />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    // An expired session is a different recovery path from a flaky connection:
    // log in again, don't retry the same request.
    expect(await screen.findByText(/signed out/i)).toBeInTheDocument();
    expect(screen.queryByText(/network error/i)).toBeNull();
  });

  it("omits videoId and note from the payload when neither is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PinLineControl line={line} />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    // Exact serialized body, so an absent videoId/note is asserted as ABSENT
    // rather than merely undefined — the zod schema rejects `videoId: null`.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companion/memories",
      expect.objectContaining({
        body: JSON.stringify({
          transcriptLineId: "l1",
          lineTextJp: "逃げるは恥だが役に立つ",
          timestampSeconds: 12.5,
        }),
      }),
    );
  });
});
