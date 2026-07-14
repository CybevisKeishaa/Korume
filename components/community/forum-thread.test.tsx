import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForumThread } from "./forum-thread";
import type { ForumPostDetail } from "@/lib/forum-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function mockFetchJson(json: unknown, opts: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: new Headers(opts.headers ?? {}),
    json: async () => json,
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const basePost: ForumPostDetail = {
  id: "post-1",
  title: "Question about te-form",
  content: "Line one\nLine two",
  topic: "grammar",
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
  author: { id: "user-1", name: "Alice", avatarUrl: null },
  comments: [
    {
      id: "comment-1",
      content: "Try this resource.",
      createdAt: "2026-07-14T01:00:00.000Z",
      author: { id: "user-2", name: "Bob", avatarUrl: null },
    },
  ],
};

describe("ForumThread", () => {
  it("renders the post content with preserved line breaks and its comments", () => {
    const { container } = render(<ForumThread post={basePost} currentUserId="user-2" />);
    expect(screen.getByRole("heading", { name: "Question about te-form" })).toBeInTheDocument();
    expect(screen.getByText("Try this resource.")).toBeInTheDocument();
    expect(container.querySelector(".whitespace-pre-line")?.textContent).toBe("Line one\nLine two");
  });

  it("shows edit/delete only for the caller's own post", () => {
    const { rerender } = render(<ForumThread post={basePost} currentUserId="user-1" />);
    expect(screen.getByRole("button", { name: /edit post/i })).toBeInTheDocument();

    rerender(<ForumThread post={basePost} currentUserId="someone-else" />);
    expect(screen.queryByRole("button", { name: /edit post/i })).not.toBeInTheDocument();
  });

  it("shows edit/delete only for the caller's own comment", () => {
    render(<ForumThread post={basePost} currentUserId="user-2" />);
    expect(screen.getByRole("button", { name: /edit comment/i })).toBeInTheDocument();
  });

  it("posts a new comment and appends it to the list", async () => {
    const fetchSpy = mockFetchJson({
      data: { id: "comment-2", createdAt: "2026-07-14T02:00:00.000Z" },
    });
    render(<ForumThread post={basePost} currentUserId="user-2" />);

    await userEvent.type(screen.getByRole("textbox", { name: /comment/i }), "New reply");
    await userEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/forum/posts/post-1/comments",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ content: "New reply" }) }),
    );
    expect(await screen.findByText("New reply")).toBeInTheDocument();
  });

  it("edits the caller's own post via PATCH", async () => {
    const fetchSpy = mockFetchJson({ data: { id: "post-1" } });
    render(<ForumThread post={basePost} currentUserId="user-1" />);

    await userEvent.click(screen.getByRole("button", { name: /edit post/i }));
    const contentBox = screen.getByRole("textbox", { name: /content/i });
    await userEvent.clear(contentBox);
    await userEvent.type(contentBox, "Updated content");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/forum/posts/post-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(await screen.findByText("Updated content")).toBeInTheDocument();
  });

  it("deletes the caller's own comment after confirming", async () => {
    mockFetchJson({}, { ok: true, status: 204 });
    render(<ForumThread post={basePost} currentUserId="user-2" />);

    await userEvent.click(screen.getByRole("button", { name: /delete comment/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes/i }));

    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it("shows a retry-after message on 429 when commenting", async () => {
    mockFetchJson({}, { ok: false, status: 429, headers: { "Retry-After": "15" } });
    render(<ForumThread post={basePost} currentUserId="user-2" />);

    await userEvent.type(screen.getByRole("textbox", { name: /comment/i }), "Reply");
    await userEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/15s/);
  });
});
