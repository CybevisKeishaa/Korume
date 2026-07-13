import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
