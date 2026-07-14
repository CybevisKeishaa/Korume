import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForumComposer } from "./forum-composer";

function mockFetchOnce(response: {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
  json?: () => Promise<unknown>;
}): ReturnType<typeof vi.fn> {
  const headers = new Headers(response.headers ?? {});
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    headers,
    json: response.json ?? (async () => ({})),
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ForumComposer", () => {
  it("posts title/topic/content to /api/forum/posts and calls onCreated", async () => {
    const fetchSpy = mockFetchOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: "post-1", createdAt: "2026-07-14T00:00:00.000Z" } }),
    });
    const onCreated = vi.fn();
    render(<ForumComposer onCreated={onCreated} />);

    await userEvent.type(screen.getByRole("textbox", { name: /title/i }), "How do I use ちゃう?");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /topic/i }), "grammar");
    await userEvent.type(screen.getByRole("textbox", { name: /content/i }), "Struggling with this pattern.");
    await userEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/forum/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "How do I use ちゃう?",
          topic: "grammar",
          content: "Struggling with this pattern.",
        }),
      }),
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("clears the form after a successful post", async () => {
    mockFetchOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: "post-1", createdAt: "2026-07-14T00:00:00.000Z" } }),
    });
    render(<ForumComposer onCreated={vi.fn()} />);

    const title = screen.getByRole("textbox", { name: /title/i }) as HTMLInputElement;
    await userEvent.type(title, "Title");
    await userEvent.type(screen.getByRole("textbox", { name: /content/i }), "Body");
    await userEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(await screen.findByText(/posted/i)).toBeInTheDocument();
    expect(title.value).toBe("");
  });

  it("shows a friendly message and does not clear the form on error", async () => {
    mockFetchOnce({ ok: false, status: 400, json: async () => ({ error: "Invalid post" }) });
    render(<ForumComposer onCreated={vi.fn()} />);

    const title = screen.getByRole("textbox", { name: /title/i }) as HTMLInputElement;
    await userEvent.type(title, "Title");
    await userEvent.type(screen.getByRole("textbox", { name: /content/i }), "Body");
    await userEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't post|could not post/i);
    expect(title.value).toBe("Title");
  });

  it("shows a retry-after message on 429", async () => {
    mockFetchOnce({ ok: false, status: 429, headers: { "Retry-After": "20" } });
    render(<ForumComposer onCreated={vi.fn()} />);

    await userEvent.type(screen.getByRole("textbox", { name: /title/i }), "Title");
    await userEvent.type(screen.getByRole("textbox", { name: /content/i }), "Body");
    await userEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/20s/);
  });

  it("disables Post while title or content is empty", () => {
    render(<ForumComposer onCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /post/i })).toBeDisabled();
  });
});
