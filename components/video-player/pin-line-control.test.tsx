import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import type { TranscriptLineRow } from "@/lib/video-types";
import { CompanionContext, type CompanionApi } from "@/components/companion/use-companion";
import { PinLineControl } from "./pin-line-control";

/** Spy on the 4-verb API, same pattern as
 * shadowing-recorder-panel.test.tsx — a stub provider, not a rendered
 * anchor, since this file is a learning-loop surface (§5.4). */
function companionSpy() {
  const emitContext = vi.fn();
  const api: CompanionApi = {
    getCurrentState: () => ({ state: "idle", phase: null }),
    emitContext,
    openJournal: vi.fn(),
    requestReflection: async () => ({ available: false }),
  };
  return { api, emitContext };
}

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

  it("opens the dialog and POSTs only the line pointer + note — video/text/timestamp are derived server-side", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, duplicate: false }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { api, emitContext } = companionSpy();
    render(
      <CompanionContext.Provider value={api}>
        <PinLineControl line={line} />
      </CompanionContext.Provider>,
    );
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.type(screen.getByLabelText(/a few words/i), "chills");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companion/memories",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          transcriptLineId: "l1",
          note: "chills",
        }),
      }),
    );
    expect(await screen.findByText(/it's in your journal now/i)).toBeInTheDocument();
    // A genuinely NEW memory tells the Companion (§5's context bus).
    expect(emitContext).toHaveBeenCalledTimes(1);
    expect(emitContext).toHaveBeenCalledWith("memory_created");
  });

  it("reports 'already kept' instead of success when the pin is a duplicate — a saved note can't be replaced, and the Companion is not told (review finding #2)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, duplicate: true }) }),
    );
    const user = userEvent.setup();
    const { api, emitContext } = companionSpy();
    render(
      <CompanionContext.Provider value={api}>
        <PinLineControl line={line} />
      </CompanionContext.Provider>,
    );
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.type(screen.getByLabelText(/a few words/i), "a new note that will not be saved");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/already kept this line/i)).toBeInTheDocument();
    expect(screen.queryByText(/it's in your journal now/i)).toBeNull();
    // No NEW memory was created, so the Companion must not react to one.
    expect(emitContext).not.toHaveBeenCalled();
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

  it("omits note from the payload when none is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, duplicate: false }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PinLineControl line={line} />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    // Exact serialized body, so an absent note is asserted as ABSENT rather
    // than merely undefined.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companion/memories",
      expect.objectContaining({
        body: JSON.stringify({
          transcriptLineId: "l1",
        }),
      }),
    );
  });
});
