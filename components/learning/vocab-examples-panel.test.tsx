import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { VocabExamplesPanel } from "./vocab-examples-panel";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name] ?? null } as Headers,
    json: async () => body,
  } as unknown as Response;
}

describe("VocabExamplesPanel", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = undefined;
  });

  it("shows curated examples plus a generate button, and appends AI examples on success", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, {
        data: [
          { id: "ai-1", vocab_id: "v-1", sentence_jp: "新しい文です。", sentence_translation: "A new sentence.", source: "ai_generated" },
        ],
        cached: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <VocabExamplesPanel
        vocabId="v-1"
        initialExamples={[
          { id: "cur-1", sentence_jp: "これは例文です。", sentence_translation: "This is an example.", source: "curated" },
        ]}
      />,
    );

    expect(screen.getByText("これは例文です。")).toBeInTheDocument();
    expect(screen.queryByText(/ai-generated/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /generate example sentences/i }));

    await waitFor(() => expect(screen.getByText("新しい文です。")).toBeInTheDocument());
    expect(screen.getAllByText(/ai-generated/i).length).toBeGreaterThan(0);
    expect(screen.getByText("これは例文です。")).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/vocab/v-1/examples");
    expect(init.method).toBe("POST");
  });

  it("shows already-generated examples without a duplicate-generation spinner story when cached", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: [
          { id: "ai-1", vocab_id: "v-1", sentence_jp: "既存の文。", sentence_translation: "Existing sentence.", source: "ai_generated" },
        ],
        cached: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VocabExamplesPanel vocabId="v-1" initialExamples={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /generate example sentences/i }));

    await waitFor(() => expect(screen.getByText("既存の文。")).toBeInTheDocument());
    expect(screen.queryByText(/generating/i)).not.toBeInTheDocument();
  });

  it("degrades to a friendly message when example generation isn't configured (503)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(503, { error: "Example generation is not configured" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VocabExamplesPanel vocabId="v-1" initialExamples={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /generate example sentences/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/isn't set up yet/i),
    );
  });

  it("shows a wait message on 429 with Retry-After", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, { error: "Too many example requests, slow down" }, { "Retry-After": "20" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VocabExamplesPanel vocabId="v-1" initialExamples={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /generate example sentences/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/try again in 20s/i),
    );
  });

  it("shows a wait message on 429 with no Retry-After header", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(429, { error: "Too many example requests, slow down" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VocabExamplesPanel vocabId="v-1" initialExamples={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /generate example sentences/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Too many example requests — please wait a moment and try again."),
    );
  });

  it("falls back to the generic wait message on 429 with a non-numeric Retry-After (e.g. an HTTP-date, RFC 9110), never rendering NaN", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, { error: "Too many example requests, slow down" }, {
        "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VocabExamplesPanel vocabId="v-1" initialExamples={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /generate example sentences/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many example requests — please wait a moment and try again.");
    expect(alert).not.toHaveTextContent(/NaN/);
  });

  it("never renders the API's own error field for a generic failure, showing a translated message and logging the status instead", async () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => jsonResponse(400, { error: "Invalid request" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VocabExamplesPanel vocabId="v-1" initialExamples={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /generate example sentences/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not generate examples right now.");
    expect(alert).not.toHaveTextContent("Invalid request");
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("400"), "Invalid request");
  });

  it("shows a translated network-error message and logs the exception when the fetch itself throws", async () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VocabExamplesPanel vocabId="v-1" initialExamples={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /generate example sentences/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network error — check your connection and try again.",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
