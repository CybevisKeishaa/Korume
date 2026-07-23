import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { VideoImportForm } from "./video-import-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

function mockFetchOnce(response: {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
  json?: () => Promise<unknown>;
}): void {
  const headers = new Headers(response.headers ?? {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      headers,
      json: response.json ?? (async () => ({})),
    } as Response),
  );
}

async function fillAndSubmit(url: string): Promise<void> {
  await userEvent.type(screen.getByLabelText(/youtube url/i), url);
  await userEvent.click(screen.getByRole("button", { name: /import video/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

describe("VideoImportForm", () => {
  it("renders the URL label and import button", () => {
    render(<VideoImportForm />);
    expect(screen.getByLabelText("YouTube URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import video" })).toBeInTheDocument();
  });

  it("shows the importing state while the request is in flight, then restores it", async () => {
    let resolveFetch!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    render(<VideoImportForm />);
    await userEvent.type(screen.getByLabelText("YouTube URL"), "https://www.youtube.com/watch?v=abc123");
    await userEvent.click(screen.getByRole("button", { name: "Import video" }));

    const importingButton = await screen.findByRole("button", { name: "Importing…" });
    expect(importingButton).toBeDisabled();

    resolveFetch({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: async () => ({ data: { id: "abc123" } }),
    });

    expect(await screen.findByRole("button", { name: "Import video" })).not.toBeDisabled();
  });

  it("imports a video, refreshes the list, and navigates to its shadowing page", async () => {
    mockFetchOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: "abc123" } }),
    });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(refresh).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/videos/abc123/shadowing");
  });

  it("clears the input on success", async () => {
    mockFetchOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: "abc123" } }),
    });

    render(<VideoImportForm />);
    const input = screen.getByLabelText<HTMLInputElement>(/youtube url/i);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(input).toHaveValue("");
  });

  it("shows a friendly message and does not navigate when metadata can't be fetched (422)", async () => {
    mockFetchOnce({ ok: false, status: 422 });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't fetch details for that video. Double-check the link and try again.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a session-expired message on 401", async () => {
    mockFetchOnce({ ok: false, status: 401 });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session expired — please sign in again.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a wait message built from the Retry-After header on 429", async () => {
    mockFetchOnce({ ok: false, status: 429, headers: { "Retry-After": "30" } });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many imports — please wait 30s and try again.",
    );
  });

  it("falls back to a generic wait message on 429 with no Retry-After header", async () => {
    mockFetchOnce({ ok: false, status: 429 });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many imports — please wait a moment and try again.",
    );
  });

  it("shows an invalid-URL message on 400", async () => {
    mockFetchOnce({ ok: false, status: 400 });

    render(<VideoImportForm />);
    await fillAndSubmit("not a real url");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That doesn't look like a valid YouTube URL.",
    );
  });

  it("does not submit an empty URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(<VideoImportForm />);
    await userEvent.click(screen.getByRole("button", { name: /import video/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That doesn't look like a valid YouTube URL.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request throws (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong importing that video. Please try again.",
    );
  });
});
