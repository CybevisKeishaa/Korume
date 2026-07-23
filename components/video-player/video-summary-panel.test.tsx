import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
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

    const generateButton = await screen.findByRole("button", { name: "Generate summary" });
    await userEvent.click(generateButton);

    await waitFor(() =>
      expect(screen.getByText(/traveler orders food/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("注文")).toBeInTheDocument();
    expect(screen.getByText(/ちゅうもん/)).toBeInTheDocument();
    expect(screen.getByText("order")).toBeInTheDocument();
    expect(screen.getByText("〜ください")).toBeInTheDocument();
    expect(
      screen.getByText("Note: the transcript was truncated to summarize it."),
    ).toBeInTheDocument();
  });

  /**
   * The AI-labeling compliance surface (CLAUDE.md AI content labeling) gets
   * its own isolated `it()` per literal — not folded into the test above —
   * per the Task 8 review finding: several assertions sharing one `it()` let
   * the first failure short-circuit past the rest, hiding the absence of a
   * compliance pin rather than failing loudly.
   */
  it("labels the panel region 'AI video summary' once a summary is ready", async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: { summary: "Already generated.", key_vocab: [], key_grammar: [], model: "m", created_at: "t" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<VideoSummaryPanel videoId="vid-1" />);

    await waitFor(() => expect(screen.getByText("Already generated.")).toBeInTheDocument());
    // Card renders a plain <div> (no implicit ARIA role), so the aria-label
    // is verified directly on the element rather than via getByRole.
    expect(container.querySelector('[aria-label="AI video summary"]')).not.toBeNull();
  });

  it("shows the exact 'AI-generated' badge once a summary is ready", async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: { summary: "Already generated.", key_vocab: [], key_grammar: [], model: "m", created_at: "t" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    await waitFor(() => expect(screen.getByText("Already generated.")).toBeInTheDocument());
    expect(screen.getByText("AI-generated")).toBeInTheDocument();
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

  /**
   * Wiring assertions for `summary.keyVocab` / `summary.keyGrammar` (I1,
   * review round 2): a mutation pass that ran only the RTL suites (pin tests
   * excluded) found these two survived a `t("summary.keyVocab")` /
   * `t("summary.keyGrammar")` swap at `video-summary-panel.tsx` — the
   * existing cached-summary test above renders both sections with empty
   * arrays, so neither heading ever mounts, and no other test asserted the
   * heading text itself. Separate `it()` per heading (Task 8 short-circuit
   * ruling): folding both into one block would let a failure on the first
   * hide a swap that only breaks the second.
   */
  it("shows the exact 'Key vocab' heading when key_vocab is non-empty", async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: {
          summary: "Already generated.",
          key_vocab: [{ word: "注文", reading: "ちゅうもん", meaning: "order" }],
          key_grammar: [],
          model: "m",
          created_at: "t",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    await waitFor(() => expect(screen.getByText("Key vocab")).toBeInTheDocument());
  });

  it("shows the exact 'Key grammar' heading when key_grammar is non-empty", async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: {
          summary: "Already generated.",
          key_vocab: [],
          key_grammar: [{ pattern: "〜ください", explanation: "polite request" }],
          model: "m",
          created_at: "t",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    await waitFor(() => expect(screen.getByText("Key grammar")).toBeInTheDocument());
  });

  it("shows the loading state (reused from common.states.loading) before the first fetch resolves", () => {
    fetchMock = vi.fn(() => new Promise(() => undefined)); // never resolves — stays in "loading"
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  // Wiring assertion for `summary.heading` (I1): the "Summary" heading
  // renders in every state, including "loading" — asserted in its own
  // `it()` so a heading regression cannot hide behind the loading test
  // above (or vice versa).
  it("shows the exact 'Summary' heading while loading", () => {
    fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    expect(screen.getByText("Summary")).toBeInTheDocument();
  });

  // Wiring assertion for `summary.empty` (I1): the "missing" state's message
  // is only ever exercised as scenery alongside the Generate button in the
  // tests below — none of them asserted its text directly.
  it("shows the exact empty-state message on the 404 (no summary yet) path", async () => {
    fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    await waitFor(() =>
      expect(screen.getByText("No summary yet for this video.")).toBeInTheDocument(),
    );
  });

  it("shows 'no transcript' message on 422", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockResolvedValueOnce(jsonResponse(422, { error: "This video has no transcript to summarize yet" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate summary" }));

    await waitFor(() =>
      expect(
        screen.getByText("This video has no transcript to summarize yet."),
      ).toBeInTheDocument(),
    );
  });

  it("degrades to a friendly message when summarization isn't configured (503)", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockResolvedValueOnce(jsonResponse(503, { error: "Summarization is not configured" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate summary" }));

    await waitFor(() =>
      expect(
        screen.getByText("AI summarization isn't set up yet for this deployment."),
      ).toBeInTheDocument(),
    );
  });

  // Wiring assertion for `summary.generating` (I1): asserted strictly
  // BETWEEN the click and the POST resolving, holding the response open
  // with a manually-resolved promise — otherwise "generating" flashes and
  // resolves within the same microtask flush and there is nothing to assert.
  it("shows the exact 'Generating summary…' label while the POST is in flight", async () => {
    let resolvePost: (value: Response) => void = () => undefined;
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolvePost = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate summary" }));

    expect(screen.getByText("Generating summary…")).toBeInTheDocument();

    resolvePost(
      jsonResponse(200, {
        data: { summary: "Done.", key_vocab: [], key_grammar: [], model: "m", created_at: "t" },
        cached: false,
      }),
    );
    await waitFor(() => expect(screen.getByText("Done.")).toBeInTheDocument());
  });

  it("shows the numeric Retry-After wait time on 429", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockResolvedValueOnce(
        jsonResponse(429, { error: "Too many summary requests" }, { "Retry-After": "30" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate summary" }));

    await waitFor(() =>
      expect(
        screen.getByText("Too many summary requests — try again in 30s."),
      ).toBeInTheDocument(),
    );
  });

  it("falls back to the generic wait message on 429 without a usable Retry-After", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockResolvedValueOnce(jsonResponse(429, { error: "Too many summary requests" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate summary" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Too many summary requests — please wait a moment and try again.",
        ),
      ).toBeInTheDocument(),
    );
  });

  /**
   * The defect fix (Task 11c): the panel used to fall back to
   * `body.error ?? "Could not generate a summary right now."`, rendering the
   * server's own English straight to the DOM and making the translated
   * string unreachable whenever the response carried any `error` field.
   * This response deliberately carries a distinctive `error` string that
   * must NOT appear anywhere in the document — only the translated generic
   * message may render.
   */
  it("never renders the server's body.error text on a generic non-2xx failure (defect fix)", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockResolvedValueOnce(
        jsonResponse(500, { error: "__SERVER_AUTHORED_TEXT_MUST_NOT_RENDER__" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate summary" }));

    await waitFor(() =>
      expect(
        screen.getByText("Could not generate a summary right now."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText(/__SERVER_AUTHORED_TEXT_MUST_NOT_RENDER__/),
    ).not.toBeInTheDocument();
  });

  it("shows a distinct message when the generate() request itself throws", async () => {
    fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "No summary yet" }))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate summary" }));

    await waitFor(() =>
      expect(screen.getByText("Couldn't generate a summary right now.")).toBeInTheDocument(),
    );
  });

  it("shows a distinct message when the initial load itself throws", async () => {
    fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoSummaryPanel videoId="vid-1" />);

    await waitFor(() =>
      expect(screen.getByText("Couldn't load the summary.")).toBeInTheDocument(),
    );
  });
});
