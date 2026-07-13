import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VideoSummaryPanel } from "./video-summary-panel";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name] ?? null } as Headers,
    json: async () => body,
  } as unknown as Response;
}

describe("VideoSummaryPanel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a Generate button when no summary exists yet (404), then renders the result", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          data: {
            summary: "A traveler orders food at a small restaurant.",
            key_vocab: [{ word: "注文", reading: "ちゅうもん", meaning: "order" }],
            key_grammar: [{ pattern: "〜ください", explanation: "polite request" }],
            model: "claude-opus-4-8",
            created_at: "2026-07-12T00:00:00Z",
          },
          cached: false,
          inputTruncated: true,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    const generateButton = await screen.findByRole("button", { name: /generate/i });
    await userEvent.click(generateButton);

    await waitFor(() =>
      expect(screen.getByText(/traveler orders food/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("注文")).toBeInTheDocument();
    expect(screen.getByText(/ちゅうもん/)).toBeInTheDocument();
    expect(screen.getByText("order")).toBeInTheDocument();
    expect(screen.getByText("〜ください")).toBeInTheDocument();
    expect(screen.getByText(/ai-generated/i)).toBeInTheDocument();
    expect(screen.getByText(/transcript.*truncated/i)).toBeInTheDocument();
  });

  it("renders an existing cached summary immediately without a Generate flow", async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: {
          summary: "Already generated.",
          key_vocab: [],
          key_grammar: [],
          model: "m",
          created_at: "t",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    await waitFor(() => expect(screen.getByText("Already generated.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /generate/i })).not.toBeInTheDocument();
  });

  it("shows 'no transcript' message on 422", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockResolvedValueOnce(jsonResponse(422, { error: "This video has no transcript to summarize yet" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /generate/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/no transcript/i),
    );
  });

  it("degrades to a friendly message when summarization isn't configured (503)", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockResolvedValueOnce(jsonResponse(503, { error: "Summarization is not configured" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /generate/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/isn't set up yet/i),
    );
  });
});
